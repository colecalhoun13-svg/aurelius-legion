/**
 * identity.ts
 * Aurelius OS v3.4 — Identity Operator
 *
 * Handles mindset, discipline, purpose, emotional regulation.
 */

export function operator_identity(payload: any) {
  const message = payload?.message;
  const memory = payload?.memory;

  return {
    domain: "identity",
    priorities: [
      "discipline",
      "clarity",
      "self-respect",
      "purpose alignment",
      "emotional regulation"
    ],
    tone: "calm, philosophical, grounded",
    context: {
      lastInsight: memory?.insights?.slice(-1)[0] ?? null
    }
  };
}
