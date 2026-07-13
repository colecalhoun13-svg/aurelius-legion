// aurelius/research/researchAdapters/llmResearchAdapter.ts

import { ResearchResult } from "../researchTypes.ts";
import { getOperatorProfile } from "../../core/operatorProfiles.ts"; // adjust path if needed
import { runLLM } from "../../llm/runLLM.ts";

export async function llmResearch(
  query: string,
  operator: string = "strategy"
): Promise<ResearchResult[]> {
  const profile = getOperatorProfile(operator);
  const decision = profile?.decisionProfile;
  const routing = profile?.routingHints;
  const memory = profile?.memoryPolicy;

  // --- 1) Choose reasoning mode ----------------------------------------------
  const reasoningMode =
    routing?.preferredReasoningMode === "chain-of-thought"
      ? "deep"
      : routing?.preferredReasoningMode === "bullets"
      ? "structured"
      : "concise";

  // --- 2) Build operator-aware system prompt ---------------------------------
  const systemPrompt = `
You are Aurelius OS v3.4 — Operator-Aware Research Assistant.
Your job is to extract factual, high-signal insights.

Operator: ${operator}
Correctness Priority: ${decision?.correctnessPriority ?? "strict"}
Reasoning Mode: ${reasoningMode}
Memory Style: ${memory?.compressionStyle ?? "high-signal"}

Rules:
- Be factual and concise.
- Highlight uncertainty.
- Avoid speculation.
- Prefer high-signal insights.
- Use the operator's reasoning mode.
- Respect strict correctness if required.
  `.trim();

  // --- 3+4) Query the LLM through the router (failover chain, not a hardcoded
  // OpenAI key). Fold the research framing into the input so it survives the
  // router's own prompt assembly. --------------------------------------------
  const response = await runLLM({
    taskType: "research",
    operator,
    input: `${systemPrompt}\n\n---\nResearch query:\n${query}`,
  });

  const text = response.text || "";

  // --- 5) Confidence scoring based on operator --------------------------------
  let confidence = 0.5;

  if (decision?.correctnessPriority === "strict") confidence = 0.4;
  if (decision?.depthBias === "deep") confidence = 0.55;
  if (decision?.depthBias === "shallow") confidence = 0.45;

  return [
    {
      title: "LLM Summary",
      snippet: text,
      source: "llm",
      confidence,
    },
  ];
}
