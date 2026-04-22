/**
 * core/engines/memoryEngine.ts
 * Aurelius OS v3.4 — Memory Engine (Wrapper)
 */

import type { Engine, EngineInput, EngineContext, EngineResult } from "../engineTypes";
import { readMemory, writeMemory } from "../memoryEngine";

export const memoryEngine: Engine = {
  name: "memoryEngine",
  async run(input: EngineInput, _ctx: EngineContext): Promise<EngineResult> {
    const { action, userId, updates } = input.payload || {};

    if (!userId || typeof userId !== "string") {
      return {
        status: "error",
        summary: "memoryEngine: 'userId' is required",
        data: {},
        logs: ["Missing userId"],
        metrics: { latencyMs: 0 },
      };
    }

    if (action === "read") {
      const memory = await readMemory(userId);
      const summary = `Read memory for user ${userId}`;
      return {
        status: "success",
        summary,
        data: { memory },
        logs: [summary],
        metrics: { latencyMs: 0 },
      };
    }

    if (action === "write") {
      const result = await writeMemory(userId, updates || {});
      const summary = `Wrote memory for user ${userId}`;
      return {
        status: "success",
        summary,
        data: { memory: result },
        logs: [summary],
        metrics: { latencyMs: 0 },
      };
    }

    return {
      status: "error",
      summary: `memoryEngine: unknown action "${action}"`,
      data: {},
      logs: ["Unknown action"],
      metrics: { latencyMs: 0 },
    };
  },
};
