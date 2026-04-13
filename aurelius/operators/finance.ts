/**
 * finance.ts
 * Aurelius OS v3.4 — Finance Operator
 *
 * Handles budgeting, cashflow, taxes, debt, liquidity, and financial planning.
 */

export function operator_finance(payload: any) {
  const message = payload?.message;
  const memory = payload?.memory;

  return {
    domain: "finance",
    priorities: [
      "cashflow clarity",
      "budget optimization",
      "debt strategy",
      "tax efficiency",
      "liquidity management"
    ],
    tone: "precise, analytical, grounded",
    context: {
      lastFinanceEntry: memory?.finance?.slice(-1)[0] ?? null
    }
  };
}
