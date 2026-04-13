/**
 * operatorRouter.ts
 * Aurelius OS v3.4 — Operator Selection Layer
 *
 * Scores the incoming message and selects the correct operator.
 * Matches your operator naming convention: operator_<name>
 */

import type { OperatorType } from "../types.ts";

// Import operators — MUST include .ts for ts-node ESM
import { operator_athlete } from "../operators/athlete.ts";
import { operator_business } from "../operators/business.ts";
import { operator_identity } from "../operators/identity.ts";
import { operator_research } from "../operators/research.ts";
import { operator_content } from "../operators/content.ts";
import { operator_accountability } from "../operators/accountability.ts";
import { operator_goal } from "../operators/goal.ts";
import { operator_tasks } from "../operators/tasks.ts";
import { operator_dailyPlanning } from "../operators/dailyPlanning.ts";
import { operator_weeklyPlanning } from "../operators/weeklyPlanning.ts";
import { operator_scheduling } from "../operators/scheduling.ts";
import { operator_reflection } from "../operators/reflection.ts";
import { operator_training } from "../operators/training.ts";
import { operator_finance } from "../operators/finance.ts";
import { operator_wealth } from "../operators/wealth.ts";
import { strategyOperator } from "../operators/strategy.ts";

/**
 * Operator Pack — aligned to your actual exports
 */
export const operatorPack: Record<OperatorType, any> = {
  athlete: operator_athlete,
  training: operator_training,
  business: operator_business,
  finance: operator_finance,
  wealth: operator_wealth,
  identity: operator_identity,
  research: operator_research,
  content: operator_content,
  accountability: operator_accountability,
  goal: operator_goal,
  tasks: operator_tasks,
  dailyPlanning: operator_dailyPlanning,
  weeklyPlanning: operator_weeklyPlanning,
  scheduling: operator_scheduling,
  reflection: operator_reflection,
  strategy: strategyOperator
};

/**
 * Scoring Logic — determines which operator should handle the message
 */
function scoreOperator(message: string, operatorName: string): number {
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
export function routeOperator(message: string) {
  let bestOperator: OperatorType = "identity";
  let bestScore = 0;

  for (const key of Object.keys(operatorPack) as OperatorType[]) {
    const score = scoreOperator(message, key);

    if (score > bestScore) {
      bestScore = score;
      bestOperator = key;
    }
  }

  return operatorPack[bestOperator];
}
