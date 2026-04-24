// aurelius/research/researchEngine.ts

import { researchConfig } from "./researchConfig.ts";
import {
  ResearchTask,
  ResearchResult,
  FusedInsight,
} from "./researchTypes.ts";

import { bingSearch } from "./researchAdapters/webSearchAdapter.ts";
import { serpSearch } from "./researchAdapters/serpSearchAdapter.ts";
import { llmResearch } from "./researchAdapters/llmResearchAdapter.ts";
import { embeddingResearch } from "./researchAdapters/embeddingResearchAdapter.ts";
import { fuseResearchResults } from "./researchFusion.ts";

import { getOperatorProfile } from "../core/operatorProfiles.ts"; // adjust path if needed

function detectUncertainty(results: ResearchResult[]): number {
  if (!results.length) return 1;
  const avg = results.reduce((a, b) => a + b.confidence, 0) / results.length;
  return 1 - avg;
}

export async function runResearch(
  task: ResearchTask
): Promise<FusedInsight[]> {
  const profile = getOperatorProfile(task.operator);
  const decision = profile?.decisionProfile;
  const memory = profile?.memoryPolicy;

  // --- 1) Determine depth using identity layer -------------------------------
  let depth: "shallow" | "medium" | "deep" = task.depth;

  if (decision?.depthBias === "deep") depth = "deep";
  if (decision?.depthBias === "medium") depth = "medium";
  if (decision?.depthBias === "shallow") depth = "shallow";

  const limit = researchConfig.depthLevels[depth];

  let results: ResearchResult[] = [];

  // --- 2) LLM research is always first --------------------------------------
  const llm = await llmResearch(task.query);
  results.push(...llm);

  // --- 3) Uncertainty-based escalation ---------------------------------------
  const uncertainty = detectUncertainty(results);

  if (uncertainty > researchConfig.uncertaintyThreshold) {
    const bing = await bingSearch(task.query);
    results.push(...bing.slice(0, limit));
  }

  // --- 4) Contradiction-based escalation -------------------------------------
  const contradiction = detectUncertainty(results);

  if (contradiction > researchConfig.contradictionThreshold) {
    const serp = await serpSearch(task.query);
    results.push(...serp.slice(0, limit));
  }

  // --- 5) Embedding-based semantic expansion ---------------------------------
  const embed = await embeddingResearch(task.query);
  results.push(...embed);

  // --- 6) Fuse results --------------------------------------------------------
  let fused = fuseResearchResults(results);

  // --- 7) Apply memory policy filtering ---------------------------------------
  fused = applyMemoryPolicy(fused, memory);

  return fused;
}

// --- Helper: filter fused insights based on memory policy ---------------------

function applyMemoryPolicy(
  insights: FusedInsight[],
  memory: any
): FusedInsight[] {
  if (!memory) return insights;

  if (memory.retentionBias === "patterns") {
    return insights.filter((i) => i.insight.length > 40);
  }

  if (memory.retentionBias === "tactics") {
    return insights.filter((i) => i.insight.length <= 80);
  }

  if (memory.retentionBias === "decisions") {
    return insights.filter((i) =>
      /should|must|decide|choose|avoid|prefer/i.test(i.insight)
    );
  }

  return insights;
}

// Export as Engine adapter
import type { Engine, EngineInput, EngineContext, EngineResult } from "../core/engineTypes.ts";

export const researchEngineAdapter: Engine = {
  name: "research",
  async run(input: EngineInput, ctx: EngineContext): Promise<EngineResult> {
    try {
      const startTime = Date.now();
      const insights = await runResearch({
        query: input.payload?.query || input.payload?.text || "",
        operator: input.payload?.operator || "strategy",
        autonomyMode: input.payload?.autonomyMode,
      });
      const latencyMs = Date.now() - startTime;

      return {
        status: "success",
        summary: "Research completed",
        text: JSON.stringify(insights),
        data: { insights },
        logs: [],
        metrics: { latencyMs },
      };
    } catch (error: any) {
      return {
        status: "error",
        summary: error.message || "Research failed",
        text: error.message,
        data: {},
        logs: [error.stack || ""],
        metrics: { latencyMs: 0 },
      };
    }
  },
};
