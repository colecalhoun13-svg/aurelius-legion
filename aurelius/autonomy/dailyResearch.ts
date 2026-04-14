// aurelius/autonomy/dailyResearch.ts
/**
 * Daily Research Engine — Aurelius OS v3.4
 * Cost-aware, topic-aware.
 */

import { researchSweep } from "../research/researchSweep.ts";
import { isHighValueTopic } from "../research/researchConfig.ts";

export async function generateDailyResearch(topic: string): Promise<string> {
  const usePerplexity = isHighValueTopic(topic);

  return await researchSweep(topic, {
    usePerplexity,
    reason: usePerplexity
      ? "High-value topic detected."
      : "Daily sweep using free engines only."
  });
}
