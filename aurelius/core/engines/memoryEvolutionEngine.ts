/**
 * Aurelius OS v3.4 — Memory Evolution Engine (Hybrid LLM Routed)
 * Handles compression, synthesis, rewriting, and long-term memory shaping.
 */

import type {
  Engine,
  EngineInput,
  EngineContext,
  EngineResult,
} from "../engineTypes";

import { evolveMemory } from "../../memory/memoryEvolutionEngine";
import { runLLM } from "../../llm/runLLM";

export const memoryEvolutionEngine: Engine = {
  name: "memoryEvolution",

  async run(input: EngineInput, ctx: EngineContext): Promise<EngineResult> {
    const { payload } = input;

    const operator = payload.operator ?? ctx.operatorId;
    const entries = payload.entries ?? [];
    const mode = payload.mode ?? "compress"; // compress | rewrite | synthesize

    // 1) Run your existing memory evolution subsystem
    const evolved = await evolveMemory({
      entries,
      operator,
      mode,
    });

    // 2) LLM synthesis layer (hybrid routed)
    const llmPrompt = `
You are Aurelius OS v3.4 — Memory Evolution Engine.
Your job is to compress, rewrite, and evolve memory entries into stable long-term knowledge.

Operator: ${operator}
Mode: ${mode}

Memory Entries:
${JSON.stringify(entries, null, 2)}

Evolved Output:
${JSON.stringify(evolved, null, 2)}

Task:
- Improve clarity
- Remove redundancy
- Strengthen signal
- Preserve meaning
- Produce a clean, operator-aware memory artifact
    `.trim();

    const llmOutput = await runLLM({
      taskType: "memory",
      operator,
      autonomyMode: "reflection",
      urgency: "low",
      input: llmPrompt,
    });

    const summary = `Memory evolution (${mode}) completed for ${entries.length} entries.`;

    return {
      status: "success",
      summary,
      data: {
        evolved,
        synthesis: llmOutput,
      },
      logs: [summary],
      metrics: {
        latencyMs: 0,
      },
    };
  },
};
