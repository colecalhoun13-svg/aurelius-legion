// aurelius/self/upgrades/researchEvolution.ts
/**
 * Research Evolution — Aurelius OS v3.4
 * Adjusts research depth + Perplexity usage based on topic patterns.
 */

import { ResearchConfig } from "../../research/researchConfig.ts";

export function evolveResearchConfig(memory: any): string {
  const topics = memory.history?.research || [];
  const upgrades: string[] = [];

  const highValueCount = topics.filter((t: string) =>
    t.toLowerCase().includes("ai") ||
    t.toLowerCase().includes("performance") ||
    t.toLowerCase().includes("business")
  ).length;

  if (highValueCount > 10) {
    ResearchConfig.enablePerplexity = true;
    upgrades.push("Enabled Perplexity for high-value research topics.");
  }

  const lowValueCount = topics.filter((t: string) =>
    t.toLowerCase().includes("random")
  ).length;

  if (lowValueCount > 5) {
    ResearchConfig.enablePerplexity = false;
    upgrades.push("Disabled Perplexity for low-value research patterns.");
  }

  return upgrades.length
    ? upgrades.join("\n")
    : "No research evolution required.";
}
