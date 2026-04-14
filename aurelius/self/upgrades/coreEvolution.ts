// aurelius/self/upgrades/coreEvolution.ts
/**
 * Operator Core Evolution — Aurelius OS v3.4
 * Adjusts operator principles + constraints based on usage patterns.
 */

import { loadCore, saveCore } from "../../operators/coreLoader.ts";
import { OperatorType } from "../../types.ts";

export function evolveOperatorCores(memory: any): string {
  const usage = memory.system?.operatorUsage || {};
  const upgrades: string[] = [];

  for (const operator of Object.keys(usage)) {
    if (!operator || operator.startsWith("engine:")) continue;

    const core = loadCore(operator as OperatorType);
    if (!core) continue;

    const count = usage[operator];

    // If operator is heavily used → strengthen principles
    if (count > 20) {
      core.principles.push("Reinforce clarity and precision under high usage load.");
      upgrades.push(`Strengthened principles for ${operator}`);
    }

    // If operator is rarely used → simplify constraints
    if (count < 3) {
      core.constraints.push("Avoid unnecessary complexity when invoked infrequently.");
      upgrades.push(`Simplified constraints for ${operator}`);
    }

    saveCore(operator as OperatorType, core);
  }

  return upgrades.length
    ? upgrades.join("\n")
    : "No operator core changes required.";
}
