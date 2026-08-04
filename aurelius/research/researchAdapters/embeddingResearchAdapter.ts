// aurelius/research/researchAdapters/embeddingResearchAdapter.ts
//
// PRIOR KNOWLEDGE as a research tier — what Aurelius already knows about the
// query, pulled from its own vector index, so a research run builds on the
// corpus instead of rediscovering it.
//
// This file used to do no retrieval at all: it INVENTED a result
// ("Semantic match for: <query>") and handed it to fusion with a real
// confidence score, so a dormant feature flag was the only thing standing
// between the system and fabricated evidence in its own synthesis. Deploy
// triage caught it. Now it queries the actual index and returns nothing when
// the index has nothing — which is the honest answer.

import { ResearchResult } from "../researchTypes.ts";
import { getOperatorProfile } from "../../core/operatorProfiles.ts";

export async function embeddingResearch(
  query: string,
  operator: string = "strategy"
): Promise<ResearchResult[]> {
  if (!query?.trim()) return [];

  const { semanticRecall } = await import("../../retrieval/retrieve.ts");
  const hits = await semanticRecall({ query, limit: 5 });
  if (!hits.length) return [];

  // Operator-aware trust: deep/correctness-first operators lean on prior
  // recall less than speed-first ones. Scaled by each hit's own similarity,
  // so a weak match can never outrank a strong external source.
  const profile = getOperatorProfile(operator);
  const base =
    profile?.decisionProfile?.depthBias === "deep"
      ? 0.5
      : operator === "athlete" || operator === "training"
        ? 0.65
        : 0.6;

  return hits.map((h) => ({
    title: `Already known — ${h.sourceType}`,
    snippet: h.chunkText.slice(0, 1200),
    source: "embedding" as const,
    confidence: Math.min(0.85, base * Math.max(0.3, h.similarity)),
  }));
}
