/**
 * workflowEngine.ts
 * Aurelius OS v3.4 — Workflow Intelligence Engine
 *
 * Converts goals → tasks → schedule → execution.
 * Produces insights for memory + self-upgrade.
 */

import type { OperatorType } from "../types.ts";
import { generateTasks } from "../tools/generateTasks.ts";
import { scheduleTasks } from "../tools/scheduleTasks.ts";
import { taskRebalancer } from "../tools/taskRebalancer.ts";
import { planDay } from "../tools/planDay.ts";
import { planWeek } from "../tools/planWeek.ts";
import { overloadDetector } from "../tools/overloadDetector.ts";
import { energyMatcher } from "../tools/energyMatcher.ts";

interface WorkflowPayload {
  userId: string;
  operator: OperatorType;
  message: string;
  engineResponse: string;
  memory: any;
}

export async function workflowEngine(payload: WorkflowPayload) {
  const { operator, message, engineResponse, memory } = payload;

  // 1. Extract actionable items from the engine response
  const tasks = await safeCall(generateTasks, {
    message,
    engineResponse,
    operator
  });

  // 2. Detect overload (training, business, or general)
  const overload = await safeCall(overloadDetector, {
    tasks,
    memory,
    operator
  });

  // 3. Match tasks to energy levels (morning, afternoon, evening)
  const energyMap = await safeCall(energyMatcher, {
    tasks,
    memory
  });

  // 4. Build a day plan (if relevant)
  const dayPlan = await safeCall(planDay, {
    tasks,
    energyMap,
    memory
  });

  // 5. Build a weekly plan (if relevant)
  const weekPlan = await safeCall(planWeek, {
    tasks,
    memory,
    operator
  });

  // 6. Rebalance tasks based on load, fatigue, or business priorities
  const rebalanced = await safeCall(taskRebalancer, {
    tasks,
    memory,
    operator
  });

  // 7. Generate insights for memory + self-upgrade
  const insights = buildInsights({
    operator,
    tasks,
    overload,
    energyMap,
    dayPlan,
    weekPlan
  });

  return {
    tasks,
    overload,
    energyMap,
    dayPlan,
    weekPlan,
    rebalanced,
    insights
  };
}

/* ---------------------------------------------------------
   SAFE WRAPPER — prevents workflow collapse
--------------------------------------------------------- */

async function safeCall(fn: Function, args: any) {
  try {
    return await fn(args);
  } catch (err) {
    console.error(`WorkflowEngine error in ${fn.name}:`, err);
    return null;
  }
}

/* ---------------------------------------------------------
   INSIGHT GENERATOR
--------------------------------------------------------- */

function buildInsights(data: any) {
  const insights: string[] = [];

  if (data.overload?.isOverloaded) {
    insights.push(
      `Overload detected in ${data.overload.domain}: ${data.overload.reason}`
    );
  }

  if (data.tasks?.length > 0) {
    insights.push(`Generated ${data.tasks.length} actionable tasks.`);
  }

  if (data.dayPlan) {
    insights.push("Day plan created based on energy + priority.");
  }

  if (data.weekPlan) {
    insights.push("Weekly plan structured for momentum + balance.");
  }

  return insights;
}
