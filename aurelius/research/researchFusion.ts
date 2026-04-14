// research/researchFusion.ts
/**
 * Research Fusion Engine — Aurelius OS v3.4
 * Cost-aware, multi-engine research.
 */

import { perplexitySearch } from "./engines/perplexityClient.ts";
import { braveSearch } from "./engines/braveClient.ts";
import { arxivSearch } from "./engines/arxivClient.ts";
import { semanticScholarSearch } from "./engines/semanticScholarClient.ts";
import { newsSearch } from "./engines/newsClient.ts";
import { ResearchConfig, isHighValueTopic } from "./researchConfig.ts";

type FusionOptions = {
  usePerplexity?: boolean;
  reason?: string;
};

export async function runResearchFusion(
  query: string,
  options: FusionOptions = {}
) {
  const shouldUsePerplexity =
    ResearchConfig.enablePerplexity &&
    (options.usePerplexity || isHighValueTopic(query));

  const [px, brave, arxiv, scholar, news] = await Promise.all([
    shouldUsePerplexity ? perplexitySearch(query) : Promise.resolve(""),
    braveSearch(query),
    arxivSearch(query),
    semanticScholarSearch(query),
    newsSearch(query)
  ]);

  return {
    meta: {
      usedPerplexity: shouldUsePerplexity,
      reason:
        options.reason ||
        (shouldUsePerplexity
          ? "High-value topic or explicit request."
          : "Free engines only for cost control.")
    },
    perplexity: px,
    brave,
    arxiv,
    scholar,
    news
  };
}
