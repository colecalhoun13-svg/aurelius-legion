// analytics/engineAnalytics.ts
/**
 * Engine Analytics — Aurelius OS v3.4
 * Tracks which engines are used most.
 */

import { loadAllMemory } from "../memory/memoryLoader.ts";

export function analyzeEngineUsage() {
  const memory = loadAllMemory();
  const usage = memory.system?.operatorUsage || {};

  const engines = Object.entries(usage)
    .filter(([key]) => key.startsWith("engine:"))
    .sort((a, b) => b[1] - a[1])
    .map(([engine, count]) => `${engine.replace("engine:", "")}: ${count}`);

  return `
Engine Usage Analysis:
${engines.join("\n")}
`.trim();
}
