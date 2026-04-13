/**
 * business.ts
 * Aurelius OS v3.4 — Business Operator
 *
 * Handles client acquisition, systems, offers, branding, revenue.
 */

export function operator_business(payload: any) {
  const message = payload?.message;
  const memory = payload?.memory;

  return {
    domain: "business",
    priorities: [
      "lead generation",
      "offer clarity",
      "systemization",
      "brand positioning",
      "revenue growth"
    ],
    tone: "strategic, tactical, ROI-driven",
    context: {
      lastClient: memory?.business?.slice(-1)[0] ?? null
    }
  };
}
