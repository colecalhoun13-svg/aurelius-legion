// aurelius/business/pnl.ts
//
// THE P&L — the one statement the money layer never actually produced. The
// earned ledger (crm/ledger.ts, payments received) and the expense summary
// (business/expenses.ts) both existed and were read SEPARATELY, so nothing ever
// said the sentence that matters: earned − spent = net. This joins them.
//
// Honest at zero by construction (the whole money layer's rule): with no
// clients the P&L is earned $0, spent whatever the tools cost, net negative —
// and it SAYS that plainly rather than rendering an encouraging blank. A real
// remote business that hasn't landed a client is running at a loss, and naming
// it is the point, not a failure to soften.
//
// Tax stays refused: this reports profit, never a tax figure (that's Cole's or
// his accountant's) — it only carries the quarterly-estimate REMINDER in words.

import { fromCents } from "../crm/service.ts";

export type ProfitAndLoss = {
  month: string;
  // Month to date.
  earnedThisMonthCents: number;
  earnedThisMonth: string;
  spentThisMonthCents: number;
  spentThisMonth: string;
  netThisMonthCents: number;
  netThisMonth: string;
  // All time (earned is the invariant sum of every Payment).
  earnedAllTimeCents: number;
  earnedAllTime: string;
  byCategory: { category: string; cents: number; label: string }[];
  headline: string;
  taxNote: string;
};

/** Month-to-date profit and loss: payments received minus expenses incurred. */
export async function profitAndLoss(month?: string): Promise<ProfitAndLoss> {
  const [{ moneyLedger }, { expenseSummary }] = await Promise.all([
    import("../crm/ledger.ts"),
    import("./expenses.ts"),
  ]);
  const [ledger, expenses] = await Promise.all([moneyLedger(), expenseSummary(month)]);

  const earnedThisMonthCents = ledger.earnedThisMonthCents;
  const spentThisMonthCents = expenses.spentCents;
  const netThisMonthCents = earnedThisMonthCents - spentThisMonthCents;

  // The one confronting sentence, honest at every scale.
  let headline: string;
  if (ledger.earnedCents === 0 && spentThisMonthCents === 0) {
    headline =
      "Nothing earned, nothing logged as spent. The P&L is empty because the business is — that's the real number, not a rounding-down.";
  } else if (earnedThisMonthCents === 0) {
    headline =
      `${expenses.spent} spent this month, nothing received — running at a loss of ${fromCents(-netThisMonthCents)}. ` +
      `That's what a pre-revenue coaching business looks like; the fix is a paying client, not a nicer chart.`;
  } else if (netThisMonthCents < 0) {
    headline = `${ledger.earnedThisMonth} in, ${expenses.spent} out this month — down ${fromCents(-netThisMonthCents)} on the month.`;
  } else {
    headline = `${ledger.earnedThisMonth} in, ${expenses.spent} out this month — ${fromCents(netThisMonthCents)} net positive.`;
  }

  return {
    month: expenses.month,
    earnedThisMonthCents,
    earnedThisMonth: ledger.earnedThisMonth,
    spentThisMonthCents,
    spentThisMonth: expenses.spent,
    netThisMonthCents,
    netThisMonth: fromCents(netThisMonthCents),
    earnedAllTimeCents: ledger.earnedCents,
    earnedAllTime: ledger.earned,
    byCategory: expenses.byCategory,
    headline,
    taxNote: expenses.quarterEstimateNote,
  };
}
