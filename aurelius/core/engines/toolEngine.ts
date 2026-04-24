/**
 * core/engines/toolEngine.ts
 * Aurelius OS v3.4 — Tool Engine (Stub)
 */

import type { Engine, EngineInput, EngineContext, EngineResult } from "../engineTypes.ts";

export const toolEngine: Engine = {
  name: "toolEngine",
  async run(input: EngineInput, _ctx: EngineContext): Promise<EngineResult> {
    const summary = "Tool engine stub — no tools wired yet.";

    return {
      status: "success",
      summary,
      data: {
        requestedTool: input.payload?.name ?? null,
        args: input.payload?.args ?? null,
      },
      logs: [summary],
      metrics: { latencyMs: 0 },
    };
  },
};
