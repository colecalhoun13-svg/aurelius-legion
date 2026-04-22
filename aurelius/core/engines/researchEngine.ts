/**
 * core/engines/researchEngine.ts
 * Aurelius OS v3.4 — Research Engine (Wrapper, Hybrid LLM Routed)
 */

import type { Engine, EngineInput, EngineContext, EngineResult } from "../engineTypes";
import { runResearch } from "../../research/researchEngine";
import { runLLM } from "../../llm/runLLM";

export const researchEngine: Engine = {
  name: "researchEngine",

  async run(input: EngineInput, ctx: EngineContext): Promise<EngineResult> {
    const { payload } = input;

    const operator = payload.operator ?? ctx.operatorId;
    const depth = payload.depth ?? "medium";

    // 1) Run your existing research pipeline (web, serp, embeddings, fusion)
    const insights = await runResearch({
      query: payload.query,
      operator,
      depth,
    });

    // 2) Let LLM synthesize a clean, operator-aware summary of the fused insights
    const synthesisPrompt = `
You are Aurelius OS v3.4 — Research Engine.
You have access to fused research insights.

Operator: ${operator}
Depth: ${depth}

Fused Insights:
${JSON.stringify(insights, null, 2)}

Task:
- Summarize the key findings
- Highlight contradictions or uncertainty if present
- Provide 3–5 clear, actionable insights for the operator
    `.trim();

    const llmOutput = await runLLM({
      taskType: "research",
      operator,
      autonomyMode: "planning",
      urgency: "low",
      input: synthesisPrompt,
    });

    const summary = `Research completed with ${insights.length} fused insights.`;

    return {
      status: "success",
      summary,
      data: {
        insights,
        synthesis: llmOutput,
      },
      logs: [summary],
      metrics: {
        latencyMs: 0, // can be overwritten by higher-level router/telemetry
      },
    };
  },
};
