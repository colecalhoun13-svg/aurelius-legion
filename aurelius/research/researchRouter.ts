// research/researchRouter.ts
/**
 * Research Router — Aurelius OS v3.4
 * Cost-aware entrypoint for research fusion.
 */

import { runResearchFusion } from "./researchFusion.ts";

export async function routeResearch(
  query: string,
  opts?: { usePerplexity?: boolean; reason?: string }
) {
  return await runResearchFusion(query, opts);
}
