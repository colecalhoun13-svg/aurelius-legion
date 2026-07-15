/**
 * Aurelius OS — runLLM()
 * Unified entrypoint for all LLM calls.
 * Routes through the Hybrid LLM Router and logs usage.
 */
import { routeLLM } from "./router.ts";
import type { LLMTask, LLMResponse, LLMOptions, OperatorContext } from "./router.ts";
import { currentTraceId } from "../core/traceContext.ts";

export type RunLLMInput = LLMTask;

export async function runLLM(params: RunLLMInput): Promise<LLMResponse> {
  const start = Date.now();
  // Capture the ambient trace id up front (the fire-and-forget log write below
  // runs in a detached async scope) so this LLM call joins its request's thread.
  const traceId = currentTraceId();

  // Compiled understanding, read side: a near-duplicate of a recent
  // question serves from cache instead of a model. Explicit engine
  // overrides and reviewer runs always go to the LLM.
  const primaryName = params.operators?.primary ?? params.operator ?? "strategy";
  if (!params.options?.engine && !params.options?.reviewer) {
    try {
      const { isReusableTask, tryReuseAnswer } = await import("../compiled/semanticReuse.ts");
      if (isReusableTask(params.taskType, params)) {
        const { resolveOperatorId } = await import("../knowledge/store.ts");
        const opId = await resolveOperatorId(primaryName);
        const reuse = opId ? await tryReuseAnswer({ operatorId: opId, input: params.input }) : null;
        if (reuse) {
          console.log(`[AURELIUS][LLM] compiled reuse (${(reuse.similarity * 100).toFixed(1)}% match) — no model call`);
          return {
            text: reuse.text,
            engine: "compiled",
            model: "reasoning_cache",
            tokensUsed: 0,
            latencyMs: Date.now() - start,
          };
        }
      }
    } catch (err) {
      console.warn("[runLLM] reuse check failed (non-fatal):", (err as any)?.message ?? err);
    }
  }

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
        context: {
          taskType: params.taskType,
          tokensUsed: response.tokensUsed ?? 0,
          latencyMs: latency,
          engine: response.engine,
          model: response.model,
          ...(response.failedOverFrom ? { failedOverFrom: response.failedOverFrom } : {}),
          ...(traceId ? { traceId } : {}),
        },
      });
    }
  })().catch(() => {});

  // Compiled understanding, write side: file this answer for future reuse.
  if (!params.options?.engine && !params.options?.reviewer) {
    (async () => {
      const { isReusableTask, recordAnswer } = await import("../compiled/semanticReuse.ts");
      if (!isReusableTask(params.taskType, params)) return;
      const { resolveOperatorId } = await import("../knowledge/store.ts");
      const opId = await resolveOperatorId(primaryName);
      if (!opId) return;
      await recordAnswer({
        operatorId: opId,
        operatorName: primaryName,
        taskType: params.taskType,
        input: params.input,
        answer: response.text,
      });
    })().catch(() => {});
  }

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