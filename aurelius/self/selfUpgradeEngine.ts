// aurelius/self/selfUpgradeEngine.ts

import { appendMemoryWrite } from "../memory/memoryWriter";
import { OperatorCore, evolveCore } from "./upgrades/coreEvolution";
import { runResearch } from "../research/researchEngine";
import { getOperatorProfile } from "../core/operatorProfiles"; // adjust path if needed

export type SelfUpgradeInput = {
  operatorCores: OperatorCore[];
  researchTopics?: string[];
  operator?: string; // NEW: which operator is evolving
};

export type SelfUpgradeResult = {
  updatedCores: OperatorCore[];
  researchInsights: string[];
};

export async function runSelfUpgrade(
  input: SelfUpgradeInput
): Promise<SelfUpgradeResult> {
  const {
    operatorCores,
    researchTopics = [],
    operator = "strategy",
  } = input;

  const profile = getOperatorProfile(operator);
  const decision = profile?.decisionProfile;
  const memory = profile?.memoryPolicy;

  const allResearchInsights: string[] = [];

  // --- 1) Run research with operator-aware depth -----------------------------
  const depth =
    decision?.depthBias === "deep"
      ? "deep"
      : decision?.depthBias === "medium"
      ? "medium"
      : "shallow";

  for (const topic of researchTopics) {
    const fused = await runResearch({
      query: topic,
      operator,
      depth,
    });

    const insights = fused.map((f) => f.insight);
    allResearchInsights.push(...insights);
  }

  // --- 2) Filter insights based on memory policy -----------------------------
  const filteredInsights = filterInsights(allResearchInsights, memory);

  // --- 3) Evolve only the relevant operator core -----------------------------
  const updatedCores: OperatorCore[] = operatorCores.map((core) => {
    if (core.name !== operator) return core;
    return evolveCore(core, filteredInsights);
  });

  // --- 4) Log the upgrade ----------------------------------------------------
  await appendMemoryWrite({
    domain: "self-upgrade",
    source: "selfUpgradeEngine",
    summary: `Self-upgrade completed for operator '${operator}'. Insights added: ${filteredInsights.length}.`,
  });

  return {
    updatedCores,
    researchInsights: filteredInsights,
  };
}

// --- Helper: filter insights based on memory policy --------------------------

function filterInsights(insights: string[], memory: any): string[] {
  if (!memory) return insights;

  if (memory.retentionBias === "patterns") {
    return insights.filter((i) => i.length > 40);
  }

  if (memory.retentionBias === "tactics") {
    return insights.filter((i) => i.length <= 80);
  }

  if (memory.retentionBias === "decisions") {
    return insights.filter((i) => /should|must|decide|choose/i.test(i));
  }

  return insights;
}
