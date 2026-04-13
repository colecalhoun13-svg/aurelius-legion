/**
 * taskRebalancer.ts
 * Aurelius OS v3.4 — Task Load Rebalancer
 */

import type { OperatorType } from "../types.ts";
import type { GeneratedTask } from "./generateTasks.ts";

interface TaskRebalancerArgs {
  tasks: GeneratedTask[] | null;
  memory: any;
  operator: OperatorType;
}

export interface RebalancedTasks {
  high: GeneratedTask[];
  medium: GeneratedTask[];
  low: GeneratedTask[];
}

export async function taskRebalancer(
  args: TaskRebalancerArgs
): Promise<RebalancedTasks | null> {
  const { tasks, memory, operator } = args;

  const list = tasks ?? [];
  if (list.length === 0) return null;

  const fatigue = memory?.training?.fatigueScore ?? null;
  const businessLoad = memory?.business?.activeProjects?.length ?? null;

  let maxHigh = 5;
  let maxMedium = 10;

  if (typeof fatigue === "number" && fatigue >= 7) {
    maxHigh = 2;
    maxMedium = 6;
  }

  if (
    (operator === "business" || operator === "strategy") &&
    typeof businessLoad === "number" &&
    businessLoad > 5
  ) {
    maxHigh = 3;
    maxMedium = 7;
  }

  const high: GeneratedTask[] = [];
  const medium: GeneratedTask[] = [];
  const low: GeneratedTask[] = [];

  for (const task of list) {
    if (task.priority === "high" && high.length < maxHigh) {
      high.push(task);
    } else if (task.priority !== "low" && medium.length < maxMedium) {
      medium.push(task);
    } else {
      low.push(task);
    }
  }

  return { high, medium, low };
}
