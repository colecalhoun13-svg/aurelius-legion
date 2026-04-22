// aurelius/research/researchAdapters/embeddingResearchAdapter.ts

import { ResearchResult } from "../researchTypes";
import { getOperatorProfile } from "../../core/operatorProfiles"; // adjust path if needed

export async function embeddingResearch(
  query: string,
  operator: string = "strategy"
): Promise<ResearchResult[]> {
  const profile = getOperatorProfile(operator);
  const decision = profile?.decisionProfile;
  const memory = profile?.memoryPolicy;

  // --- 1) Operator-aware confidence ------------------------------------------
  let confidence = 0.4;

  // Deep operators trust embeddings less (correctness > speed)
  if (decision?.depthBias === "deep") confidence = 0.35;

  // Athlete/training operators trust embeddings more (speed > correctness)
  if (operator === "athlete" || operator === "training") confidence = 0.5;

  // Identity operators prefer narrative → embeddings become more useful
  if (operator === "identity") confidence = 0.55;

  // --- 2) Memory-aware snippet formatting ------------------------------------
  let snippet = `Semantic match for: ${query}`;

  if (memory?.compressionStyle === "high-signal") {
    snippet = `High-signal semantic match: ${query}`;
  }

  if (memory?.compressionStyle === "checklist") {
    snippet = `• Semantic match: ${query}`;
  }

  if (memory?.compressionStyle === "narrative") {
    snippet = `This relates semantically to the idea of "${query}".`;
  }

  // --- 3) Return identity-aware embedding result ------------------------------
  return [
    {
      title: "Embedding Similarity Insight",
      snippet,
      source: "embedding",
      confidence,
    },
  ];
}
