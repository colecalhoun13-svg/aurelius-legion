/**
 * Aurelius OS v3.4 — Canonical Engine Registration
 * This file defines the authoritative engine registry for the entire OS.
 */

import { registerEngine } from "./engineRegistry";
import type { Engine, EngineInput, EngineContext, EngineResult } from "./engineTypes";

// LLM Engines
import { gptAdapter } from "../engines/gptEngine";
import { geminiAdapter } from "../engines/geminiEngine";
import { groqAdapter } from "../engines/groqEngine";
import { anthropicAdapter } from "../engines/anthropicEngine";
import { deepseekAdapter } from "../engines/deepseekEngine";
import { xaiAdapter } from "../engines/xaiClient";

// Aurelius Internal Engines (if using EngineAdapter pattern)
import { researchEngineAdapter } from "../research/researchEngine";
import { memoryEvolutionEngineAdapter } from "../memory/memoryEvolutionEngine";
import { autonomyEngineAdapter } from "../autonomy/autonomyEngine";
import { reflectionEngineAdapter } from "../autonomy/reflectionEngine";

// Adapter wrapper: converts EngineAdapter to Engine
function wrapAdapter(adapter: any): Engine {
  return {
    name: adapter.name,
    async run(input: EngineInput, ctx: EngineContext): Promise<EngineResult> {
      try {
        const startTime = Date.now();
        const response = await adapter.run({
          model: input.payload?.model || "default",
          systemPrompt: input.systemPrompt,
          userPrompt: input.payload?.message || input.payload?.text || JSON.stringify(input.payload),
          tools: input.payload?.tools,
          context: input.payload?.context,
        });
        const latencyMs = Date.now() - startTime;

        return {
          status: "success",
          summary: response.text?.slice(0, 100) || "Engine executed",
          text: response.text,
          data: { raw: response.raw },
          logs: [],
          metrics: { latencyMs, tokensIn: response.tokensUsed, tokensOut: 0 },
          tokensUsed: response.tokensUsed,
        };
      } catch (error: any) {
        return {
          status: "error",
          summary: error.message || "Engine failed",
          text: error.message,
          data: {},
          logs: [error.stack || ""],
          metrics: { latencyMs: 0 },
        };
      }
    },
  };
}

export function registerAllEngines() {
  // LLM Engines
  registerEngine(wrapAdapter(gptAdapter));
  registerEngine(wrapAdapter(geminiAdapter));
  registerEngine(wrapAdapter(groqAdapter));
  registerEngine(wrapAdapter(anthropicAdapter));
  registerEngine(wrapAdapter(deepseekAdapter));
  registerEngine(wrapAdapter(xaiAdapter));

  // Aurelius Internal Engines (if already Engine type)
  registerEngine(researchEngineAdapter);
  registerEngine(memoryEvolutionEngineAdapter);
  registerEngine(autonomyEngineAdapter);
  registerEngine(reflectionEngineAdapter);
}
