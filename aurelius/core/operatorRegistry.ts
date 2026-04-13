/**
 * operatorRegistry.ts
 * Aurelius OS v3.4 — Operator Registry
 *
 * Central map of all operator modules.
 * Each operator returns: { domain, priorities, tone, context }
 */

import { operator_athlete } from "../operators/athlete.ts";
import { operator_business } from "../operators/business.ts";
import { operator_content } from "../operators/content.ts";
import { operator_finance } from "../operators/finance.ts";
import { operator_identity } from "../operators/identity.ts";
import { operator_research } from "../operators/research.ts";
import { operator_scheduling } from "../operators/scheduling.ts";
import { operator_strategy } from "../operators/strategy.ts";
import { operator_training } from "../operators/training.ts";
import { operator_wealth } from "../operators/wealth.ts";

import { operator_dailyPlanning } from "../operators/dailyPlanning.ts";
import { operator_weeklyPlanning } from "../operators/weeklyPlanning.ts";
import { operator_tasks } from "../operators/tasks.ts";
import { operator_goal } from "../operators/goal.ts";
import { operator_accountability } from "../operators/accountability.ts";
import { operator_reflection } from "../operators/reflection.ts";

// Type for registry entries
export type OperatorHandler = (payload: any) => {
  domain: string;
  priorities: string[];
  tone: string;
  context: any;
};

// Registry map
export const operatorRegistry: Record<string, OperatorHandler> = {
  athlete: operator_athlete,
  business: operator_business,
  content: operator_content,
  finance: operator_finance,
  identity: operator_identity,
  research: operator_research,
  scheduling: operator_scheduling,
  strategy: operator_strategy,
  training: operator_training,
  wealth: operator_wealth,

  dailyPlanning: operator_dailyPlanning,
  weeklyPlanning: operator_weeklyPlanning,
  tasks: operator_tasks,
  goal: operator_goal,
  accountability: operator_accountability,
  reflection: operator_reflection
};

// Safe getter
export function getOperatorProfile(operator: string, payload: any) {
  const handler = operatorRegistry[operator];

  if (!handler) {
    console.warn(`OperatorRegistry: Unknown operator "${operator}"`);
    return {
      domain: "general",
      priorities: ["clarity", "usefulness"],
      tone: "neutral",
      context: {}
    };
  }

  return handler(payload);
}
