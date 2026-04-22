// aurelius/core/nervousSystem.ts

import { runAutonomyCycle } from "../autonomy/autonomyEngineDB.ts";
import { createLogEntry } from "../repositories/logRepository.ts";
import {
  listAllOperators,
  updateOperatorLastRun,
  updateOperatorMode,
  type OperatorRecord,
} from "../repositories/operatorRepository.ts";
import {
  computeEffectivePriority,
  computeEffectiveCooldown,
} from "./operatorModes.ts";

type NervousSystemTickResult = {
  timestamp: string;
  operatorsEvaluated: number;
  operatorsExecuted: number;
  executions: {
    operatorName: string;
    operatorId: string;
    mode: string;
    skippedReason?: string;
  }[];
};

function isOperatorEligible(
  op: OperatorRecord,
  now: Date
): { eligible: boolean; reason?: string } {
  const cooldownSeconds = computeEffectiveCooldown(op);
  const lastRunAt = op.lastRunAt;

  if (!lastRunAt) {
    return { eligible: true };
  }

  const elapsedSeconds =
    (now.getTime() - lastRunAt.getTime()) / 1000;

  if (elapsedSeconds >= cooldownSeconds) {
    return { eligible: true };
  }

  return {
    eligible: false,
    reason: `Cooldown active (${elapsedSeconds.toFixed(
      1
    )}s elapsed, needs ${cooldownSeconds}s).`,
  };
}

export async function runNervousSystemTick(): Promise<NervousSystemTickResult> {
  const now = new Date();
  const operators = await listAllOperators();

  const sorted = [...operators].sort((a, b) => {
    const pa = computeEffectivePriority(a);
    const pb = computeEffectivePriority(b);
    if (pa !== pb) return pb - pa;
    return a.name.localeCompare(b.name);
  });

  const executions: NervousSystemTickResult["executions"] = [];
  let executedCount = 0;

  for (const op of sorted) {
    const eligibility = isOperatorEligible(op, now);

    if (!eligibility.eligible) {
      executions.push({
        operatorName: op.name,
        operatorId: op.id,
        mode: op.mode,
        skippedReason: eligibility.reason,
      });
      continue;
    }

    const autonomy = await runAutonomyCycle(op.name);

    await updateOperatorLastRun(op.id, now);

    await createLogEntry({
      operatorId: op.id,
      type: "nervous_system",
      level: "info",
      message: `Nervous system tick executed for operator '${op.name}' in mode '${op.mode}'.`,
      context: { autonomy, mode: op.mode },
    });

    executions.push({
      operatorName: op.name,
      operatorId: op.id,
      mode: op.mode,
    });

    executedCount++;
  }

  return {
    timestamp: now.toISOString(),
    operatorsEvaluated: operators.length,
    operatorsExecuted: executedCount,
    executions,
  };
}
