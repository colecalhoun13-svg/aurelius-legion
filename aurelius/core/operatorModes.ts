// aurelius/core/operatorModes.ts

import type { OperatorRecord, OperatorMode } from "../repositories/operatorRepository.ts";

export type OperatorStats = {
  recentExecutions: number;
  recentSkips: number;
};

export function computeEffectivePriority(
  op: OperatorRecord
): number {
  const base = op.priority ?? 1;

  switch (op.mode) {
    case "idle":
      return Math.max(1, base - 1);
    case "normal":
      return base;
    case "focus":
      return base + 1;
    case "aggressive":
      return base + 2;
    default:
      return base;
  }
}

export function computeEffectiveCooldown(
  op: OperatorRecord
): number {
  const base = op.cooldownSeconds ?? 60;

  switch (op.mode) {
    case "idle":
      return base * 2;
    case "normal":
      return base;
    case "focus":
      return Math.max(10, base * 0.5);
    case "aggressive":
      return Math.max(5, base * 0.25);
    default:
      return base;
  }
}

export function determineNextMode(
  op: OperatorRecord,
  stats: OperatorStats
): OperatorMode {
  if (stats.recentExecutions === 0 && stats.recentSkips > 5) {
    return "idle";
  }

  if (stats.recentExecutions > 5 && stats.recentSkips === 0) {
    return "aggressive";
  }

  if (stats.recentExecutions > 3 && stats.recentSkips <= 2) {
    return "focus";
  }

  return "normal";
}
