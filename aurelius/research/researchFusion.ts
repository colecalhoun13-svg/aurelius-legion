// aurelius/research/researchFusion.ts

import { ResearchResult, FusedInsight } from "./researchTypes";
import { getOperatorProfile } from "../core/operatorProfiles"; // adjust path if needed

export function fuseResearchResults(
  results: ResearchResult[],
  operator: string = "strategy"
): FusedInsight[] {
  if (!results.length) return [];

  const profile = getOperatorProfile(operator);
  const decision = profile?.decisionProfile;
  const memory = profile?.memoryPolicy;

  // --- 1) Weight sources based on operator domain ----------------------------
  const sourceWeights: Record<string, number> = {
    llm: decision?.correctnessPriority === "strict" ? 0.8 : 1.0,
    bing: 1.0,
    serpapi: 1.1,
    embedding: 0.7,
  };

  // Strategy & Wealth prefer higher correctness → downweight embeddings
  if (operator === "strategy" || operator === "wealth") {
    sourceWeights.embedding = 0.5;
  }

  // Athlete & Training prefer speed → upweight embeddings
  if (operator === "athlete" || operator === "training") {
    sourceWeights.embedding = 1.0;
  }

  // --- 2) Bucket by normalized title -----------------------------------------
  const buckets: Record<string, FusedInsight> = {};

  for (const r of results) {
    const key = normalizeKey(r.title);

    const weightedConfidence = r.confidence * (sourceWeights[r.source] ?? 1);

    if (!buckets[key]) {
      buckets[key] = {
        insight: r.title,
        confidence: weightedConfidence,
        supportingSources: [r],
      };
    } else {
      buckets[key].supportingSources.push(r);
      buckets[key].confidence =
        (buckets[key].confidence + weightedConfidence) / 2;
    }
  }

  let fused = Object.values(buckets);

  // --- 3) Apply memory policy compression ------------------------------------
  fused = applyMemoryCompression(fused, memory);

  // --- 4) Sort by confidence --------------------------------------------------
  fused.sort((a, b) => b.confidence - a.confidence);

  return fused;
}

// --- Helpers -----------------------------------------------------------------

function normalizeKey(title: string): string {
  return title.toLowerCase().trim().replace(/[^a-z0-9]+/g, " ");
}

function applyMemoryCompression(
  insights: FusedInsight[],
  memory: any
): FusedInsight[] {
  if (!memory) return insights;

  if (memory.compressionStyle === "high-signal") {
    return insights.map((i) => ({
      ...i,
      insight: extractSignal(i.insight),
    }));
  }

  if (memory.compressionStyle === "checklist") {
    return insights.map((i) => ({
      ...i,
      insight: `• ${extractChecklist(i.insight)}`,
    }));
  }

  if (memory.compressionStyle === "narrative") {
    return insights.map((i) => ({
      ...i,
      insight: extractNarrative(i.insight),
    }));
  }

  return insights;
}

function extractSignal(text: string): string {
  return text.split("—")[0].trim();
}

function extractChecklist(text: string): string {
  return text.replace(/Reflection:|Insight:/gi, "").trim();
}

function extractNarrative(text: string): string {
  return `This suggests that ${text.toLowerCase()}.`;
}
