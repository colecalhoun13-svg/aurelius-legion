// aurelius/memory/memoryEvolutionEngine.ts

import {
  MemoryPacket,
  SynthesizedMemory,
} from "../memoryEvolution/memoryEvolutionTypes";

import { compressMemory } from "../memoryEvolution/memoryCompressor";
import { synthesizeMemory } from "../memoryEvolution/memorySynthesizer";
import type { Engine, EngineInput, EngineContext, EngineResult } from "../core/engineTypes";

export async function runMemoryEvolution(
  packets: MemoryPacket[]
): Promise<SynthesizedMemory> {
  const compressed = compressMemory(packets);
  const synthesized = synthesizeMemory(compressed);

  return synthesized;
}

export const memoryEvolutionEngineAdapter: Engine = {
  name: "memory:evolution",
  async run(input: EngineInput, ctx: EngineContext): Promise<EngineResult> {
    try {
      const startTime = Date.now();
      const packets = input.payload?.packets || [];
      const synthesized = await runMemoryEvolution(packets);
      const latencyMs = Date.now() - startTime;

      return {
        status: "success",
        summary: "Memory evolution completed",
        text: "Memories synthesized and evolved",
        data: { synthesized },
        logs: [],
        metrics: { latencyMs },
      };
    } catch (error: any) {
      return {
        status: "error",
        summary: error.message || "Memory evolution failed",
        text: error.message,
        data: {},
        logs: [error.stack || ""],
        metrics: { latencyMs: 0 },
      };
    }
  },
};
