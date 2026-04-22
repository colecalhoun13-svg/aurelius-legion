// aurelius/memoryEvolution/memorySynthesizer.ts

import { CompressedMemory, SynthesizedMemory } from "./memoryEvolutionTypes";
import { memoryEvolutionConfig } from "./memoryEvolutionConfig";

export function synthesizeMemory(
  compressed: CompressedMemory
): SynthesizedMemory {
  const lines = compressed.summary.split(".").slice(0, memoryEvolutionConfig.synthesisDepth);

  const evolvedIdentity = lines.map((l) => `Identity Insight: ${l.trim()}`);
  const evolvedOperators = lines.map((l) => `Operator Insight: ${l.trim()}`);
  const evolvedPreferences = lines.map((l) => `Preference Insight: ${l.trim()}`);

  return {
    evolvedIdentity,
    evolvedOperators,
    evolvedPreferences,
  };
}
