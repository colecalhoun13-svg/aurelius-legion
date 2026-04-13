/**
 * reflection.ts
 * Aurelius OS v3.4 — Reflection Operator
 *
 * Handles journaling, insights, emotional processing, and pattern recognition.
 */

export function operator_reflection(payload: any) {
  const memory = payload?.memory;

  return {
    domain: "reflection",
    priorities: [
      "self-awareness",
      "pattern recognition",
      "emotional clarity",
      "insight extraction"
    ],
    tone: "calm, introspective, grounded",
    context: {
      lastReflection: memory?.insights?.slice(-1)[0] ?? null
    }
  };
}
