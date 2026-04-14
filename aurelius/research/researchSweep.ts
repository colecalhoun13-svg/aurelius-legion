// research/researchSweep.ts
/**
 * High-Level Research Sweep — Aurelius OS v3.4
 * Synthesizes multi-engine research with cost-aware routing.
 */

import { routeResearch } from "./researchRouter.ts";
import { engineRouter } from "../core/engineRouter.ts";

export async function researchSweep(
  topic: string,
  opts?: { usePerplexity?: boolean; reason?: string }
): Promise<string> {
  const raw = await routeResearch(topic, opts);

  const systemPrompt = `
You are the RESEARCH operator inside Aurelius OS v3.4.
You are given multi-engine research results plus metadata.

Your job:
- Identify agreements
- Identify contradictions
- Extract trends
- Distill principles
- Surface open questions
- Note whether Perplexity was used and why
`;

  const synthesis = await engineRouter(
    "research",
    systemPrompt,
    JSON.stringify(raw)
  );

  return synthesis;
}
