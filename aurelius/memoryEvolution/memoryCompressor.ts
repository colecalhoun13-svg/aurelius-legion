// aurelius/memoryEvolution/memoryCompressor.ts

import { MemoryPacket, CompressedMemory } from "./memoryEvolutionTypes";
import { memoryEvolutionConfig } from "./memoryEvolutionConfig";

export function compressMemory(
  packets: MemoryPacket[]
): CompressedMemory {
  const recent = packets.slice(-memoryEvolutionConfig.compressionDepth);

  const combined = recent
    .map((p) => p.insights.map((i) => i.text).join(" "))
    .join(" ");

  const keyPoints = combined
    .split(".")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .slice(0, 5);

  return {
    summary: combined.slice(0, 500),
    keyPoints,
    confidence: 0.6,
  };
}
