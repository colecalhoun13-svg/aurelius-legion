/**
 * Aurelius OS v3.4 — Autonomy Engine (Hybrid LLM Routed)
 * Handles planning, reflection, decision reasoning, and operator-aware thinking.
 */

import type { Engine, EngineInput, EngineContext, EngineResult } from "../engineTypes.ts";
import { runLLM } from "../../llm/runLLM.ts";

export const autonomyEngine: Engine = {
  name: "autonomyEngine",

  async run(input: EngineInput, ctx: EngineContext): Promise<EngineResult> {
    const { payload } = input;

    const operator = payload.operator ?? ctx.operatorId;
    const mode = payload.mode ?? "reactive"; // reactive | planning | reflection
    const task = payload.task ?? "";
    const context = payload.context ?? "";

    // 1) Build the autonomy prompt
    const autonomyPrompt = `
You are Aurelius OS v3.4 — Autonomy Engine.
Your job is to think, plan, reflect, and make operator-aware decisions.

Operator: ${operator}
Autonomy Mode: ${mode}

Task:
${task}

Context:
${context}

Return:
- Clear reasoning
- A structured plan or reflection
- Operator-specific insights
- Next actions if relevant
    `.trim();

    // 2) Route through hybrid LLM brain
    const llmOutput = await runLLM({
      taskType: mode === "planning" ? "plan" : mode === "reflection" ? "reflection" : "analysis",
      operator,
      autonomyMode: mode,
      urgency: payload.urgency ?? "medium",
      input: autonomyPrompt,
    });

    const summary = `Autonomy (${mode}) completed for operator ${operator}.`;

    return {
      status: "success",
      summary,
      data: {
        output: llmOutput,
        mode,
        operator,
      },
      logs: [summary],
      metrics: {
        latencyMs: 0, // overwritten by router telemetry
      },
    };
  },
};
