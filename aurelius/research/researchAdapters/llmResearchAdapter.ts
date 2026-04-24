// aurelius/research/researchAdapters/llmResearchAdapter.ts

import { ResearchResult } from "../researchTypes.ts";
import { getOperatorProfile } from "../../core/operatorProfiles.ts"; // adjust path if needed
import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "" });

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

  // --- 3) Choose model tier based on operator --------------------------------
  const model =
    routing?.preferredModelTier === "premium"
      ? "gpt-4o"
      : routing?.preferredModelTier === "balanced"
      ? "gpt-4o-mini"
      : "gpt-4o-mini";

  // --- 4) Query the LLM -------------------------------------------------------
  const completion = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: query },
    ],
  });

  const text = completion.choices[0].message.content || "";

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
