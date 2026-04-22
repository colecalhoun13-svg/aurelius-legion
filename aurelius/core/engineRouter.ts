// aurelius/core/engineRouter.ts

import { getEngine } from "./engineRegistry";
import { EngineContext, EngineResult, RoutedTask } from "./engineTypes";
import { buildEngineContext } from "./operatorHelpers";

export async function routeTask(
  task: RoutedTask,
  payload: any = {},
  systemPrompt?: string,
  ctxOverrides: Partial<EngineContext> = {}
): Promise<EngineResult> {
  const engineName = task.engine || task.type;
  const engine = getEngine(engineName);
  
  if (!engine) {
    return {
      status: "error",
      summary: `Engine '${engineName}' not found`,
      text: `Engine '${engineName}' not found.`,
      data: {},
      logs: [],
      metrics: { latencyMs: 0 },
    };
  }

  const operatorId = ctxOverrides.operatorId || "default";
  const ctx = buildEngineContext(operatorId);
  const mergedCtx = { ...ctx, ...ctxOverrides };

  return engine.run(
    {
      type: task.type,
      payload: payload || task.payload,
      systemPrompt,
    },
    mergedCtx
  );
}

// Temporary alias for backwards compatibility
export const runWithEngine = routeTask;
