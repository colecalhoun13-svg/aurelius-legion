/**
 * Aurelius OS v3.4 — DB-backed Autonomy (Routed)
 */

import { routeTask } from "../core/engineRouter";
import type { EngineContext } from "../core/engineTypes";

import { getOperatorIdByName } from "../core/operatorHelpers";
import {
  createAutonomyGoal,
  listActiveAutonomyGoals,
  updateAutonomyGoalStatus,
} from "../repositories/autonomyGoalRepository";
import { createLogEntry } from "../repositories/logRepository";

function buildEngineContext(operatorId: string): EngineContext {
  const now = new Date().toISOString();

  return {
    requestId: `autonomy-${operatorId}-${now}`,
    operatorId,
    timestamp: now,
    logger: {
      info: (msg, meta) => console.log("[autonomy][info]", msg, meta),
      warn: (msg, meta) => console.warn("[autonomy][warn]", msg, meta),
      error: (msg, meta) => console.error("[autonomy][error]", msg, meta),
    },
    memory: {
      read: async () => null,
      write: async () => {},
      search: async () => [],
    },
    tools: {
      runTool: async () => null,
    },
    config: { environment: "dev" },
  };
}

export async function runAutonomyCycle(operatorName = "strategy") {
  const operatorId = await getOperatorIdByName(operatorName);

  let goal = (await listActiveAutonomyGoals(operatorId))[0];

  if (!goal) {
    goal = await createAutonomyGoal({
      operatorId,
      description: "Initialize autonomy goals for this operator.",
      status: "pending",
      priority: "normal",
    });
  }

  const ctx = buildEngineContext(operatorId);

  const result = await routeTask(
    {
      id: `autonomy-${goal.id}`,
      type: "autonomy",
      payload: {
        operator: operatorName,
        goal: goal.description,
        history: [],
      },
      source: "system",
      priority: "normal",
    },
    ctx
  );

  await updateAutonomyGoalStatus(goal.id, "completed");

  await createLogEntry({
    operatorId,
    type: "autonomy",
    level: "info",
    message: `Autonomy cycle executed for operator '${operatorName}'.`,
    context: { result },
  });

  return {
    operatorName,
    operatorId,
    goal: goal.description,
    events: result.data.events ?? [],
  };
}
