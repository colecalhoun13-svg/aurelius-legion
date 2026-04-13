/**
 * overloadDetector.ts
 * Aurelius OS v3.4 — Load / Overload Detection
 */

import type { OperatorType } from "../types.ts";
import type { GeneratedTask } from "./generateTasks.ts";

interface OverloadDetectorArgs {
  tasks: GeneratedTask[] | null;
  memory: any;
  operator: OperatorType;
}

export interface OverloadResult {
  isOverloaded: boolean;
  domain: OperatorType | "global";
  reason: string;
  taskCount: number;
}

export async function overloadDetector(
  args: OverloadDetectorArgs
): Promise<OverloadResult | null> {
  const { tasks, memory, operator } = args;

  const taskCount = tasks?.length ?? 0;
  const recentFatigue = memory?.training?.fatigueScore ?? null;
  const businessLoad = memory?.business?.activeProjects?.length ?? null;

  let isOverloaded = false;
  let domain: OverloadResult["domain"] = "global";
  let reason = "";

  if (taskCount > 15) {
    isOverloaded = true;
    domain = operator;
    reason = `High task volume (${taskCount} tasks).`;
  }

  if (operator === "training" || operator === "athlete") {
    if (typeof recentFatigue === "number" && recentFatigue >= 7) {
      isOverloaded = true;
      domain = "training";
      reason = reason
        ? `${reason} Fatigue score is high (${recentFatigue}/10).`
        : `Fatigue score is high (${recentFatigue}/10).`;
    }
  }

  if (operator === "business" || operator === "strategy" || operator === "wealth" || operator === "finance") {
    if (typeof businessLoad === "number" && businessLoad > 5) {
      isOverloaded = true;
      domain = "business";
      reason = reason
        ? `${reason} Too many active projects (${businessLoad}).`
        : `Too many active projects (${businessLoad}).`;
    }
  }

  if (!isOverloaded) {
    return {
      isOverloaded: false,
      domain: operator,
      reason: "",
      taskCount
    };
  }

  return {
    isOverloaded,
    domain,
    reason,
    taskCount
  };
}
