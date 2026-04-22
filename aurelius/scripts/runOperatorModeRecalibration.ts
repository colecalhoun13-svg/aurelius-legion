// aurelius/scripts/runOperatorModeRecalibration.ts

import {
  listAllOperators,
  updateOperatorMode,
} from "../repositories/operatorRepository.ts";
import {
  determineNextMode,
  type OperatorStats,
} from "../core/operatorModes.ts";

async function main() {
  const operators = await listAllOperators();

  for (const op of operators) {
    const stats: OperatorStats = {
      recentExecutions: 0,
      recentSkips: 0,
    };

    const nextMode = determineNextMode(op, stats);

    if (nextMode !== op.mode) {
      await updateOperatorMode(op.id, nextMode);
      console.log(
        `Updated operator '${op.name}' mode: ${op.mode} -> ${nextMode}`
      );
    } else {
      console.log(
        `Operator '${op.name}' remains in mode: ${op.mode}`
      );
    }
  }
}

main().catch((err) => {
  console.error("Error recalibrating operator modes:", err);
  process.exit(1);
});
