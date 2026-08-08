// aurelius/business/expenses.ts
//
// EXPENSES — the honest negative.
//
// A side business at zero revenue is not at zero: it costs money to exist —
// tools, subscriptions, equipment, the odd course. A dashboard that shows
// "received this month" with no "spent this month" is half a ledger, and the
// encouraging half at that. This module records what the business COSTS so
// the treasury can say both numbers.
//
// Capture-only and INWARD everywhere: Cole (or a capture path) records an
// expense; nothing is deducted anywhere, nothing files anything, and anything
// involving the IRS stays Cole's hand — the quarterly note in expenseSummary
// is a reminder in words, not a computation of tax owed (a confidently-wrong
// tax figure is the one number worse than none).
//
// Money is integer cents, converted once at the boundary (crm/service.toCents),
// same as the rest of the money layer.

import { prisma } from "../core/db/prisma.ts";
import { toCents, fromCents } from "../crm/service.ts";

// Loosely Schedule-C shaped, matching the Expense model's vocabulary — a
// typo'd category would silently vanish from every by-category rollup.
export const EXPENSE_CATEGORIES = ["software", "equipment", "education", "marketing", "fees", "other"] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export type AddExpenseInput = {
  /** Dollars in ("$14.99", 14.99) — stored as integer cents. */
  amount: number | string;
  category?: string;
  note?: string;
  incurredAt?: string | Date;
  /** "cole" (his hand) | "capture" (brain-dump splitter) | "receipt". */
  source?: string;
};

export async function addExpense(input: AddExpenseInput) {
  const amountCents = toCents(input.amount);
  if (amountCents === 0) throw new Error("An expense of zero isn't an expense.");
  const category = (input.category ?? "other").trim().toLowerCase();
  if (!(EXPENSE_CATEGORIES as readonly string[]).includes(category)) {
    throw new Error(`category must be one of: ${EXPENSE_CATEGORIES.join(", ")} (got "${input.category}")`);
  }
  let incurredAt = new Date();
  if (input.incurredAt !== undefined && input.incurredAt !== null && input.incurredAt !== "") {
    incurredAt = input.incurredAt instanceof Date ? input.incurredAt : new Date(input.incurredAt);
    if (Number.isNaN(incurredAt.getTime())) {
      throw new Error(`incurredAt is not a valid date: ${JSON.stringify(input.incurredAt)}`);
    }
  }
  return prisma.expense.create({
    data: {
      amountCents,
      category,
      note: input.note?.trim() || null,
      incurredAt,
      source: (input.source ?? "cole").slice(0, 40),
    },
  });
}

/** "YYYY-MM" (default: the current month) → [start, end) plus the label. */
function monthRange(month?: string): { start: Date; end: Date; label: string } {
  let y: number, m: number;
  if (month && /^\d{4}-\d{2}$/.test(month.trim())) {
    const [ys, ms] = month.trim().split("-");
    y = Number(ys);
    m = Number(ms) - 1;
    if (m < 0 || m > 11) throw new Error(`month must be YYYY-MM (got "${month}")`);
  } else if (month) {
    throw new Error(`month must be YYYY-MM (got "${month}")`);
  } else {
    const now = new Date();
    y = now.getFullYear();
    m = now.getMonth();
  }
  const start = new Date(y, m, 1);
  const end = new Date(y, m + 1, 1);
  return { start, end, label: `${y}-${String(m + 1).padStart(2, "0")}` };
}

export async function listExpenses(opts: { month?: string; category?: string; limit?: number } = {}) {
  const where: Record<string, any> = {};
  if (opts.month) {
    const { start, end } = monthRange(opts.month);
    where.incurredAt = { gte: start, lt: end };
  }
  if (opts.category) {
    const c = opts.category.trim().toLowerCase();
    if (!(EXPENSE_CATEGORIES as readonly string[]).includes(c)) {
      throw new Error(`category must be one of: ${EXPENSE_CATEGORIES.join(", ")} (got "${opts.category}")`);
    }
    where.category = c;
  }
  return prisma.expense.findMany({
    where,
    orderBy: { incurredAt: "desc" },
    take: Math.min(opts.limit ?? 50, 500),
  });
}

export type ExpenseSummary = {
  month: string;
  count: number;
  spentCents: number;
  spent: string;
  byCategory: { category: string; cents: number; label: string }[];
  /** The one-line quarterly-estimated-tax reminder — words, never a computed
   *  tax figure. Deliberately NOT a cron: it rides along wherever the summary
   *  is read (chat, the money endpoint, the treasury chip's tooltip). */
  quarterEstimateNote: string;
};

export async function expenseSummary(month?: string): Promise<ExpenseSummary> {
  const { start, end, label } = monthRange(month);
  const rows = await prisma.expense.findMany({
    where: { incurredAt: { gte: start, lt: end } },
    select: { amountCents: true, category: true },
  });
  const spentCents = rows.reduce((s, r) => s + r.amountCents, 0);
  const byCat = new Map<string, number>();
  for (const r of rows) byCat.set(r.category, (byCat.get(r.category) ?? 0) + r.amountCents);
  const byCategory = [...byCat.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([category, cents]) => ({ category, cents, label: fromCents(cents) }));

  return {
    month: label,
    count: rows.length,
    spentCents,
    spent: fromCents(spentCents),
    byCategory,
    quarterEstimateNote:
      "Self-employment profit (payments received minus expenses like these) generally owes quarterly estimated tax — mid-April, mid-June, mid-September, mid-January; the amounts and the filing are yours (or your accountant's), never Aurelius's.",
  };
}
