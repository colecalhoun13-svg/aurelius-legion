// aurelius/router/operatorRouter.ts
/**
 * operatorRouter.ts
 * Aurelius OS v3.4 — Operator Selection Layer
 *
 * Scores the incoming message and selects the correct operator.
 */

import type { OperatorType } from "../types.ts";

export const operatorPack: Record<OperatorType, any> = {
  athlete: null,
  training: null,
  business: null,
  finance: null,
  wealth: null,
  identity: null,
  research: null,
  content: null,
  accountability: null,
  goal: null,
  tasks: null,
  dailyPlanning: null,
  weeklyPlanning: null,
  scheduling: null,
  reflection: null,
  strategy: null
};

/**
 * Scoring Logic — determines which operator should handle the message
 */
function scoreOperator(message: string, operatorName: OperatorType): number {
  const lower = message.toLowerCase();

  switch (operatorName) {
    case "athlete":
    case "training":
      return lower.includes("workout") ||
        lower.includes("speed") ||
        lower.includes("strength")
        ? 0.9
        : 0.2;

    case "business":
      return lower.includes("business") ||
        lower.includes("offer") ||
        lower.includes("clients")
        ? 0.9
        : 0.3;

    case "finance":
    case "wealth":
      return lower.includes("money") ||
        lower.includes("invest") ||
        lower.includes("budget")
        ? 0.9
        : 0.3;

    case "strategy":
      return lower.includes("strategy") ||
        lower.includes("plan") ||
        lower.includes("systems") ||
        lower.includes("leverage")
        ? 0.95
        : 0.4;

    case "identity":
      return lower.includes("identity") ||
        lower.includes("purpose") ||
        lower.includes("who am i")
        ? 0.85
        : 0.2;

    case "research":
      return lower.includes("research") ||
        lower.includes("study") ||
        lower.includes("find me")
        ? 0.9
        : 0.3;

    case "content":
      return lower.includes("write") ||
        lower.includes("caption") ||
        lower.includes("script")
        ? 0.9
        : 0.3;

    case "accountability":
      return lower.includes("hold me") ||
        lower.includes("check in") ||
        lower.includes("remind me")
        ? 0.85
        : 0.2;

    case "goal":
      return lower.includes("goal") ||
        lower.includes("target") ||
        lower.includes("objective")
        ? 0.9
        : 0.3;

    case "tasks":
      return lower.includes("task") ||
        lower.includes("todo") ||
        lower.includes("list")
        ? 0.9
        : 0.3;

    case "dailyPlanning":
      return lower.includes("today") ||
        lower.includes("daily") ||
        lower.includes("morning")
        ? 0.9
        : 0.3;

    case "weeklyPlanning":
      return lower.includes("week") ||
        lower.includes("weekly")
        ? 0.9
        : 0.3;

    case "scheduling":
      return lower.includes("schedule") ||
        lower.includes("calendar") ||
        lower.includes("time")
        ? 0.9
        : 0.3;

    case "reflection":
      return lower.includes("reflect") ||
        lower.includes("journal") ||
        lower.includes("thoughts")
        ? 0.9
        : 0.3;

    default:
      return 0.1;
  }
}

/**
 * Main Router — selects the highest scoring operator
 */
export function routeOperator(message: string): OperatorType {
  let bestOperator: OperatorType = "identity";
  let bestScore = 0;

  for (const key of Object.keys(operatorPack) as OperatorType[]) {
    const score = scoreOperator(message, key);

    if (score > bestScore) {
      bestScore = score;
      bestOperator = key;
    }
  }

  return bestOperator;
}
