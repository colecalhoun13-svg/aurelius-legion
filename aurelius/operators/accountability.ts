/**
 * accountability.ts
 * Aurelius OS v3.4 — Accountability Operator
 *
 * Handles discipline, consistency, check-ins, and calling out drift.
 */

export function operator_accountability(payload: any) {
  const message = payload?.message;
  const memory = payload?.memory;

  return {
    domain: "accountability",
    priorities: [
      "consistency",
      "discipline",
      "execution",
      "momentum",
      "course correction"
    ],
    tone: "direct, challenging, no-nonsense",
    context: {
      lastTask: memory?.tasks?.slice(-1)[0] ?? null
    }
  };
}
