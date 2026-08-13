// aurelius/finance/service.ts
//
// PERSONAL FINANCE (NORTH_STAR #51) — Cole's OWN money, a separate world from
// the business ledger. Net worth + cashflow, so a big call (go part-time, a
// large purchase) is made against a real number, not a vibe.
//
// HARD BOUNDARIES (verified before ship, like the Athlete Zero council):
//   • These tables are NEVER read by any business query, and the business P&L /
//     ledger / analyst are never read here — two separate money worlds.
//   • This data is NEVER indexed into the vector store (hard rule 6) — it's
//     written with raw prisma and never passes through setKnowledge/embed, so a
//     balance or transaction can't surface in a prompt.
//   • Inward + private: reporting only, no outward surface, no sharing.
//
// Integer cents throughout (the money-layer invariant). Snapshots are written
// ONLY when Cole updates a balance (his choice) — no automatic writes.

import { prisma } from "../core/db/prisma.ts";
import { fromCents } from "../crm/service.ts";
import crypto from "node:crypto";

// Personal money is SIGNED (a transaction can be money out, a balance can be
// overdrawn) — so this can't use the business toCents(), which rejects negatives.
function signedCents(input: number | string): number {
  const n = typeof input === "number" ? input : Number(String(input).replace(/[$,\s]/g, ""));
  if (!Number.isFinite(n)) throw new Error(`Not a valid amount: ${JSON.stringify(input)}`);
  return Math.round(n * 100);
}

export const ACCOUNT_KINDS = ["checking", "savings", "investment", "cash", "debt"] as const;
export const LIQUID_KINDS = ["checking", "savings", "cash"] as const;
export const FINANCE_CATEGORIES = [
  "income", "housing", "food", "transport", "utilities", "health",
  "giving", "savings", "discretionary", "other",
] as const;

// A tiny keyword categorizer for CSV rows — a starting guess Cole can correct,
// never a confident claim. Everything unmatched is "other".
const CATEGORY_HINTS: Array<[RegExp, string]> = [
  [/salary|payroll|deposit|paycheck|venmo from|zelle from/i, "income"],
  [/rent|mortgage|hoa/i, "housing"],
  [/grocery|market|restaurant|coffee|doordash|uber eats/i, "food"],
  [/uber|lyft|gas|fuel|shell|chevron|parking/i, "transport"],
  [/electric|water|internet|comcast|verizon|at&t|phone/i, "utilities"],
  [/gym|pharmacy|doctor|dental|medical|insurance/i, "health"],
  [/church|tithe|donation|charity/i, "giving"],
  [/transfer to savings|savings/i, "savings"],
];

function categorize(description: string): string {
  for (const [re, cat] of CATEGORY_HINTS) if (re.test(description)) return cat;
  return "other";
}

// ── Accounts + net worth ─────────────────────────────────────────────

export async function listAccounts() {
  return prisma.financeAccount.findMany({ orderBy: { createdAt: "asc" } });
}

export async function addAccount(input: { name: string; kind?: string; balance?: string | number; currency?: string }) {
  const kind = (input.kind && (ACCOUNT_KINDS as readonly string[]).includes(input.kind)) ? input.kind : "checking";
  const balanceCents = input.balance != null ? signedCents(input.balance) : 0;
  const acct = await prisma.financeAccount.create({
    data: { name: input.name.trim(), kind, balanceCents, currency: input.currency ?? "usd", lastBalanceAt: new Date() },
  });
  await snapshotNetWorth(); // a new account changes net worth
  return acct;
}

/** Update a balance — and snapshot net worth (Cole's chosen cadence: on update). */
export async function updateBalance(accountId: string, balance: string | number): Promise<{ ok: boolean; error?: string }> {
  const acct = await prisma.financeAccount.findUnique({ where: { id: accountId } });
  if (!acct) return { ok: false, error: "No such account." };
  await prisma.financeAccount.update({ where: { id: accountId }, data: { balanceCents: signedCents(balance), lastBalanceAt: new Date() } });
  await snapshotNetWorth();
  return { ok: true };
}

export type NetWorth = {
  assetsCents: number; assets: string;
  liabilitiesCents: number; liabilities: string;
  netCents: number; net: string;
  trend: { at: string; net: string; netCents: number }[]; // recent snapshots, oldest→newest
  accounts: { id: string; name: string; kind: string; balance: string; balanceCents: number }[];
};

export async function netWorth(): Promise<NetWorth> {
  const [accounts, snaps] = await Promise.all([
    prisma.financeAccount.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.netWorthSnapshot.findMany({ orderBy: { at: "desc" }, take: 12 }),
  ]);
  // Debt accounts store the amount OWED (positive) and subtract from net.
  const assetsCents = accounts.filter((a) => a.kind !== "debt").reduce((s, a) => s + a.balanceCents, 0);
  const liabilitiesCents = accounts.filter((a) => a.kind === "debt").reduce((s, a) => s + a.balanceCents, 0);
  const netCents = assetsCents - liabilitiesCents;
  return {
    assetsCents, assets: fromCents(assetsCents),
    liabilitiesCents, liabilities: fromCents(liabilitiesCents),
    netCents, net: fromCents(netCents),
    trend: snaps.reverse().map((s) => ({ at: s.at.toISOString().slice(0, 10), net: fromCents(s.netCents), netCents: s.netCents })),
    accounts: accounts.map((a) => ({ id: a.id, name: a.name, kind: a.kind, balance: fromCents(a.balanceCents), balanceCents: a.balanceCents })),
  };
}

async function snapshotNetWorth(): Promise<void> {
  const accounts = await prisma.financeAccount.findMany({ select: { kind: true, balanceCents: true } });
  const assetsCents = accounts.filter((a) => a.kind !== "debt").reduce((s, a) => s + a.balanceCents, 0);
  const liabilitiesCents = accounts.filter((a) => a.kind === "debt").reduce((s, a) => s + a.balanceCents, 0);
  await prisma.netWorthSnapshot.create({
    data: { assetsCents, liabilitiesCents, netCents: assetsCents - liabilitiesCents },
  });
}

// ── Transactions + cashflow ──────────────────────────────────────────

export async function addTxn(input: { date?: string; amount: string | number; category?: string; description?: string; accountId?: string }): Promise<{ ok: boolean; error?: string }> {
  const cents = signedCents(input.amount); // caller signs it: + in, - out
  if (!Number.isFinite(cents) || cents === 0) return { ok: false, error: "A transaction needs a non-zero amount (+ in, - out)." };
  const category = input.category && (FINANCE_CATEGORIES as readonly string[]).includes(input.category) ? input.category : "other";
  await prisma.financeTxn.create({
    data: {
      accountId: input.accountId ?? null,
      date: input.date ? new Date(input.date) : new Date(),
      amountCents: cents,
      category,
      description: input.description?.slice(0, 300) ?? null,
      source: "manual",
    },
  });
  return { ok: true };
}

/** Import CSV rows. Idempotent: a row's importHash (date|amount|description) is
 *  unique, so re-dropping the same export is a no-op, not a double-count. */
export async function importCsv(rows: Array<{ date: string; amount: string | number; description?: string; category?: string }>): Promise<{ imported: number; skipped: number }> {
  let imported = 0;
  let skipped = 0;
  for (const r of rows) {
    const cents = signedCents(r.amount);
    if (!Number.isFinite(cents) || cents === 0) { skipped++; continue; }
    const desc = (r.description ?? "").slice(0, 300);
    const importHash = crypto.createHash("sha256").update(`${r.date}|${cents}|${desc}`).digest("hex").slice(0, 32);
    const category = r.category && (FINANCE_CATEGORIES as readonly string[]).includes(r.category) ? r.category : categorize(desc);
    try {
      await prisma.financeTxn.create({
        data: { date: new Date(r.date), amountCents: cents, description: desc || null, category, source: "csv", importHash },
      });
      imported++;
    } catch (err: any) {
      if (err?.code === "P2002") skipped++; // already imported (idempotent)
      else throw err;
    }
  }
  return { imported, skipped };
}

export type Cashflow = {
  month: string;
  inCents: number; in: string;
  outCents: number; out: string;
  netCents: number; net: string;
  byCategory: { category: string; cents: number; label: string }[]; // outflow by category, biggest first
};

export async function cashflow(month?: string): Promise<Cashflow> {
  const now = new Date();
  const start = month ? new Date(`${month}-01T00:00:00`) : new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
  const txns = await prisma.financeTxn.findMany({ where: { date: { gte: start, lt: end } }, select: { amountCents: true, category: true } });
  const inCents = txns.filter((t) => t.amountCents > 0).reduce((s, t) => s + t.amountCents, 0);
  const outCents = txns.filter((t) => t.amountCents < 0).reduce((s, t) => s + Math.abs(t.amountCents), 0);
  const byCat = new Map<string, number>();
  for (const t of txns) if (t.amountCents < 0) byCat.set(t.category, (byCat.get(t.category) ?? 0) + Math.abs(t.amountCents));
  return {
    month: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`,
    inCents, in: fromCents(inCents),
    outCents, out: fromCents(outCents),
    netCents: inCents - outCents, net: fromCents(inCents - outCents),
    byCategory: [...byCat.entries()].sort((a, b) => b[1] - a[1]).map(([category, cents]) => ({ category, cents, label: fromCents(cents) })),
  };
}

/** Months of expenses covered by LIQUID assets — the number that makes a big
 *  life call real. Null (honest) until there's enough spend history to average. */
export async function runwayMonths(): Promise<{ months: number | null; note: string }> {
  const accounts = await prisma.financeAccount.findMany({ where: { kind: { in: [...LIQUID_KINDS] } }, select: { balanceCents: true } });
  const liquid = accounts.reduce((s, a) => s + a.balanceCents, 0);
  const since = new Date();
  since.setMonth(since.getMonth() - 3);
  const out = await prisma.financeTxn.aggregate({ where: { date: { gte: since }, amountCents: { lt: 0 } }, _sum: { amountCents: true } });
  const spent3mo = Math.abs(out._sum.amountCents ?? 0);
  if (spent3mo === 0) return { months: null, note: "No spending history yet — runway needs a few months of transactions to mean anything." };
  const avgMonthly = spent3mo / 3;
  const months = Math.round((liquid / avgMonthly) * 10) / 10;
  return { months, note: `${fromCents(liquid)} liquid ÷ ~${fromCents(Math.round(avgMonthly))}/mo spend.` };
}

/** The whole dashboard in one read (the /finance tab). */
export async function financeDashboard() {
  const [nw, cf, runway] = await Promise.all([netWorth(), cashflow(), runwayMonths()]);
  const empty = nw.accounts.length === 0 && cf.inCents === 0 && cf.outCents === 0;
  const headline = empty
    ? "Nothing entered yet — add an account balance or import a CSV and your picture builds from real numbers."
    : `Net worth ${nw.net} · this month ${cf.net} (${cf.in} in, ${cf.out} out)${runway.months != null ? ` · ${runway.months}mo runway` : ""}.`;
  return { netWorth: nw, cashflow: cf, runway, headline, empty };
}
