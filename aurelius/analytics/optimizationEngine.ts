// analytics/optimizationEngine.ts
/**
 * Optimization Engine — Aurelius OS v3.4
 * Uses analytics to adjust system behavior.
 */

import { loadAllMemory } from "../memory/memoryLoader.ts";
import { ResearchConfig } from "../research/researchConfig.ts";

export function optimizeSystem() {
  const memory = loadAllMemory();
  const usage = memory.system?.operatorUsage || {};

  // If research operator is used heavily → increase Perplexity usage
  const researchCount = usage["research"] || 0;

  if (researchCount > 20) {
    ResearchConfig.enablePerplexity = true;
  }

  // If Perplexity engine is used too much → throttle it
  const perplexityCount = usage["engine:perplexity"] || 0;

  if (perplexityCount > 50) {
    ResearchConfig.enablePerplexity = false;
  }

  // If strategy operator is used heavily → increase weekly research depth
  const strategyCount = usage["strategy"] || 0;

  if (strategyCount > 15) {
    ResearchConfig.weeklyUsesPerplexity = true;
  }

  return `
Optimization Summary:
- Research operator usage: ${researchCount}
- Perplexity usage: ${perplexityCount}
- Strategy usage: ${strategyCount}

Updated Config:
- Perplexity enabled: ${ResearchConfig.enablePerplexity}
- Weekly uses Perplexity: ${ResearchConfig.weeklyUsesPerplexity}
`.trim();
}
