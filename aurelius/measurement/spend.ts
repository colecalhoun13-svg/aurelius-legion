// aurelius/measurement/spend.ts
//
// WHAT AURELIUS COSTS, AND WHICH PARTS OF IT COST THAT.
//
// Reads the `llm_call` LogEntry rows that runLLM already writes — no second
// write path, so the ledger cannot drift from the calls it describes.
//
// The number Cole actually needs is not "total spend"; it's "which job is
// eating the money." A monthly total tells him he's over budget. A per-taskType
// breakdown tells him the curriculum doubled and the weekend sweep is 60% of
// it — that's a decision he can act on, and it's why every summary here
// groups by taskType and model rather than just totalling.
//
// UNPRICED CALLS ARE COUNTED SEPARATELY AND LOUDLY. A model missing from the
// price table contributes tokens but no dollars; folding it in as zero would
// quietly understate the bill and, worse, make an expensive unknown model look
// free. Every summary carries `unpricedCalls` for exactly this reason.

import { prisma } from "../core/db/prisma.ts";
import { formatUsd, monthlyBudgetUsd, PRICES_AS_OF } from "../llm/pricing.ts";

export type SpendBucket = {
  key: string;
  calls: number;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  unpricedCalls: number;
};

export type SpendSummary = {
  since: Date;
  days: number;
  calls: number;
  tokensIn: number;
  tokensOut: number;
  tokensCachedIn: number;
  costUsd: number;
  cost: string;
  unpricedCalls: number;
  byTaskType: SpendBucket[];
  byModel: SpendBucket[];
  byDay: { day: string; costUsd: number; calls: number }[];
  pricesAsOf: string;
  /** Always true — these are hand-maintained estimates, not a billing feed. */
  estimated: true;
};

function emptyBucket(key: string): SpendBucket {
  return { key, calls: 0, tokensIn: 0, tokensOut: 0, costUsd: 0, unpricedCalls: 0 };
}

function add(b: SpendBucket, ctx: any) {
  b.calls++;
  b.tokensIn += Number(ctx?.tokensIn ?? 0) || 0;
  b.tokensOut += Number(ctx?.tokensOut ?? 0) || 0;
  if (typeof ctx?.costUsd === "number") b.costUsd += ctx.costUsd;
  else b.unpricedCalls++;
}

const dayKey = (d: Date) => d.toLocaleDateString("en-CA"); // YYYY-MM-DD, process TZ

/** Spend over the last `days`, broken down by what spent it. */
export async function spendSummary(days = 30): Promise<SpendSummary> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return summarize(since, days);
}

/** Spend since the 1st of the current local month — what the budget is against. */
export async function monthToDate(): Promise<SpendSummary> {
  const now = new Date();
  const since = new Date(now.getFullYear(), now.getMonth(), 1);
  const days = Math.max(1, Math.ceil((now.getTime() - since.getTime()) / 86_400_000));
  return summarize(since, days);
}

async function summarize(since: Date, days: number): Promise<SpendSummary> {
  const rows = await prisma.logEntry.findMany({
    where: { type: "llm_call", createdAt: { gte: since } },
    select: { context: true, createdAt: true },
    // Bounded: a runaway loop must not pull a million rows into memory to
    // answer "what did I spend". 50k calls is far beyond any real month here.
    take: 50_000,
    orderBy: { createdAt: "desc" },
  });

  const total = emptyBucket("total");
  let tokensCachedIn = 0;
  const byTask = new Map<string, SpendBucket>();
  const byModel = new Map<string, SpendBucket>();
  const byDay = new Map<string, { day: string; costUsd: number; calls: number }>();

  for (const row of rows) {
    const ctx = (row.context ?? {}) as any;
    add(total, ctx);
    tokensCachedIn += Number(ctx?.tokensCachedIn ?? 0) || 0;

    const taskKey = String(ctx?.taskType ?? "unknown");
    if (!byTask.has(taskKey)) byTask.set(taskKey, emptyBucket(taskKey));
    add(byTask.get(taskKey)!, ctx);

    const modelKey = `${ctx?.engine ?? "?"}/${ctx?.model ?? "?"}`;
    if (!byModel.has(modelKey)) byModel.set(modelKey, emptyBucket(modelKey));
    add(byModel.get(modelKey)!, ctx);

    const d = dayKey(row.createdAt);
    const bucket = byDay.get(d) ?? { day: d, costUsd: 0, calls: 0 };
    bucket.calls++;
    if (typeof ctx?.costUsd === "number") bucket.costUsd += ctx.costUsd;
    byDay.set(d, bucket);
  }

  const desc = (a: SpendBucket, b: SpendBucket) => b.costUsd - a.costUsd || b.calls - a.calls;

  return {
    since,
    days,
    calls: total.calls,
    tokensIn: total.tokensIn,
    tokensOut: total.tokensOut,
    tokensCachedIn,
    costUsd: total.costUsd,
    cost: formatUsd(total.costUsd),
    unpricedCalls: total.unpricedCalls,
    byTaskType: [...byTask.values()].sort(desc),
    byModel: [...byModel.values()].sort(desc),
    byDay: [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day)),
    pricesAsOf: PRICES_AS_OF,
    estimated: true,
  };
}

/** One line for the doctor, the briefing, and the self tool. */
export async function spendLine(): Promise<string> {
  const mtd = await monthToDate();
  const budget = monthlyBudgetUsd();
  const base = `${mtd.cost} month-to-date across ${mtd.calls} call${mtd.calls === 1 ? "" : "s"} (estimated, prices as of ${mtd.pricesAsOf})`;
  const unpriced = mtd.unpricedCalls > 0 ? ` · ${mtd.unpricedCalls} call(s) on unpriced models — real total is higher` : "";
  if (!budget) return `${base}${unpriced} · no monthly budget set (LLM_MONTHLY_BUDGET_USD)`;
  const pct = Math.round((mtd.costUsd / budget) * 100);
  return `${base}${unpriced} · ${pct}% of the ${formatUsd(budget)} budget`;
}

// ── the alarm ────────────────────────────────────────────────────────
// Dormant without LLM_MONTHLY_BUDGET_USD (hard rule 4). Fires ONCE per
// threshold per month: an alarm that repeats daily gets muted, and a muted
// alarm is worse than none.

const THRESHOLDS = [80, 100] as const;

export type BudgetCheck = {
  configured: boolean;
  budgetUsd: number | null;
  spentUsd: number;
  pct: number | null;
  fired: number[];
};

export async function checkBudget(): Promise<BudgetCheck> {
  const budget = monthlyBudgetUsd();
  const mtd = await monthToDate();
  if (!budget) return { configured: false, budgetUsd: null, spentUsd: mtd.costUsd, pct: null, fired: [] };

  const pct = (mtd.costUsd / budget) * 100;
  const month = new Date().toLocaleDateString("en-CA").slice(0, 7); // YYYY-MM
  const fired: number[] = [];

  for (const threshold of THRESHOLDS) {
    if (pct < threshold) continue;
    // Dedup on (month, threshold) via the signal's sourceId — survives
    // restarts, unlike an in-process flag.
    const sourceId = `budget:${month}:${threshold}`;
    const already = await prisma.bridgeSignal.count({ where: { sourceType: "llm_budget", sourceId } });
    if (already > 0) continue;

    const worst = mtd.byTaskType.slice(0, 3).filter((b) => b.costUsd > 0);
    const { surfaceSignal } = await import("../core/bridge.ts");
    await surfaceSignal({
      kind: threshold >= 100 ? "risk" : "opportunity",
      domain: "personal",
      sourceType: "llm_budget",
      sourceId,
      severity: threshold >= 100 ? "attention" : "notice",
      title:
        threshold >= 100
          ? `Over the monthly LLM budget — ${mtd.cost} of ${formatUsd(budget)}`
          : `${Math.round(pct)}% of the monthly LLM budget used`,
      body:
        `${mtd.cost} spent this month against a ${formatUsd(budget)} budget, across ${mtd.calls} calls.\n\n` +
        (worst.length
          ? `Where it went:\n${worst.map((b) => `• ${b.key} — ${formatUsd(b.costUsd)} (${b.calls} calls)`).join("\n")}\n\n`
          : "") +
        (mtd.unpricedCalls > 0
          ? `${mtd.unpricedCalls} call(s) ran on models not in the price table, so the real figure is higher than this.\n\n`
          : "") +
        `These are hand-maintained estimates (prices as of ${mtd.pricesAsOf}), not a billing feed — check the provider console for the actual bill. ` +
        `The biggest levers are the weekly curriculum (2 units × 7 fields) and the Sunday research sweeps; both can be re-timed or paused from Settings.`,
    });
    fired.push(threshold);
  }

  return { configured: true, budgetUsd: budget, spentUsd: mtd.costUsd, pct, fired };
}
