/**
 * Aurelius OS — runLLM()
 * Unified entrypoint for all LLM calls.
 * Routes through the Hybrid LLM Router and logs usage.
 */
import { routeLLM } from "./router.ts";
import type { LLMTask, LLMResponse, LLMOptions } from "./router.ts";

export type RunLLMInput = LLMTask;

export async function runLLM(params: RunLLMInput): Promise<LLMResponse> {
  const start = Date.now();

  const response = await routeLLM(params);

  const latency = Date.now() - start;

  console.log("[AURELIUS][LLM]", {
    taskType: params.taskType,
    operator: params.operator,
    engine: response.engine,
    model: response.model,
    tokensUsed: response.tokensUsed,
    reviewed: !!response.reviewed,
    latencyMs: latency,
    timestamp: new Date().toISOString(),
  });

  return response;
}

// Re-export for convenience
export type { LLMTask, LLMResponse, LLMOptions };