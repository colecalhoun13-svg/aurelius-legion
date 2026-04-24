// aurelius/research/researchAdapters/webSearchAdapter.ts

import { ResearchResult } from "../researchTypes.ts";
import { researchConfig } from "../researchConfig.ts";
import { getOperatorProfile } from "../../core/operatorProfiles.ts"; // adjust path if needed

export async function bingSearch(
  query: string,
  operator: string = "strategy"
): Promise<ResearchResult[]> {
  if (!researchConfig.providers.bing.apiKey) return [];

  const profile = getOperatorProfile(operator);
  const decision = profile?.decisionProfile;

  // Strict correctness → lower base confidence
  let baseConfidence = decision?.correctnessPriority === "strict" ? 0.55 : 0.65;

  const endpoint = `https://api.bing.microsoft.com/v7.0/search?q=${encodeURIComponent(
    query
  )}`;

  const res = await fetch(endpoint, {
    headers: { "Ocp-Apim-Subscription-Key": researchConfig.providers.bing.apiKey },
  });

  const data = await res.json();
  const webResults = data.webPages?.value || [];

  return webResults.map((item: any) => ({
    title: item.name,
    snippet: item.snippet,
    url: item.url,
    source: "bing",
    confidence: baseConfidence,
  }));
}
