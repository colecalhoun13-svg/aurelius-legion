/**
 * athlete.ts
 * Aurelius OS v3.4 — Athlete Operator
 *
 * Handles athletic identity, performance, speed, strength, power.
 */

export function operator_athlete(payload: any) {
  const message = payload?.message;
  const memory = payload?.memory;

  return {
    domain: "athlete",
    priorities: [
      "movement quality",
      "speed development",
      "strength progression",
      "fatigue management",
      "performance readiness"
    ],
    tone: "direct, technical, high-performance",
    context: {
      lastTraining: memory?.training?.slice(-1)[0] ?? null
    }
  };
}

