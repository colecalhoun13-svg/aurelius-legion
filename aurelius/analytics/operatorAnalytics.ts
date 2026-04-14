// analytics/operatorAnalytics.ts
/**
 * Operator Analytics — Aurelius OS v3.4
 * Detects patterns in operator usage.
 */

import { loadAllMemory } from "../memory/memoryLoader.ts";

export function analyzeOperatorUsage() {
  const memory = loadAllMemory();
  const usage = memory.system?.operatorUsage || {};

  const sorted = Object.entries(usage)
    .sort((a, b) => b[1] - a[1])
    .map(([op, count]) => `${op}: ${count}`);

  return `
Operator Usage Analysis:
${sorted.join("\n")}
`.trim();
}
