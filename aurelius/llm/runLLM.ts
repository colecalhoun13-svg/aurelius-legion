/**
 * Aurelius OS — runLLM()
 * Unified entrypoint for all LLM calls.
 * Routes through the Hybrid LLM Router and logs usage.
 */
import { routeLLM } from "./router.ts";
import type { LLMTask, LLMResponse, LLMOptions, OperatorContext } from "./router.ts";

export type RunLLMInput = LLMTask;

export async function runLLM(params: RunLLMInput): Promise<LLMResponse> {
  const start = Date.now();

  const response = await routeLLM(params);

  const latency = Date.now() - start;

  // Measurement plane: every LLM call lands in LogEntry so the scoreboard
  // can prove dependence falling as compiled reasoning takes over.
  // Fire-and-forget — telemetry never blocks or fails a call.
  (async () => {
    const { resolveOperatorId } = await import("../knowledge/store.ts");
    const { createLogEntry } = await import("../repositories/logRepository.ts");
    const primary = params.operators?.primary ?? params.operator ?? "strategy";
    const operatorId = (await resolveOperatorId(primary)) ?? (await resolveOperatorId("strategy"));
    if (operatorId) {
      await createLogEntry({
        operatorId,
        type: "llm_call",
        level: "info",
        message: `${response.engine}/${response.model}`,
        context: { taskType: params.taskType, tokensUsed: response.tokensUsed ?? 0, latencyMs: latency },
      });
    }
  })().catch(() => {});

  console.log("[AURELIUS][LLM]", {
    taskType: params.taskType,
    operators: params.operators ?? { primary: params.operator ?? "n/a", secondaries: [] },
    engine: response.engine,
    model: response.model,
    tokensUsed: response.tokensUsed,
    reviewed: !!response.reviewed,
    latencyMs: latency,
    timestamp: new Date().toISOString(),
  });

  return response;
}

export type { LLMTask, LLMResponse, LLMOptions, OperatorContext };