// aurelius/research/researchAdapters/serpSearchAdapter.ts

import { ResearchResult } from "../researchTypes";
import { researchConfig } from "../researchConfig";
import { getOperatorProfile } from "../../core/operatorProfiles"; // adjust path if needed

export async function serpSearch(
  query: string,
  operator: string = "strategy"
): Promise<ResearchResult[]> {
  if (!researchConfig.providers.serpapi.apiKey) return [];

  const profile = getOperatorProfile(operator);
  const decision = profile?.decisionProfile;

  // SerpAPI is higher‑quality → higher base confidence
  let baseConfidence = decision?.correctnessPriority === "strict" ? 0.65 : 0.75;

  const endpoint = `https://serpapi.com/search.json?q=${encodeURIComponent(
    query
  )}&api_key=${researchConfig.providers.serpapi.apiKey}`;

  const res = await fetch(endpoint);
  const data = await res.json();

  const organic = data.organic_results || [];

  return organic.map((item: any) => ({
    title: item.title,
    snippet: item.snippet || item.snippet_highlighted_words?.join(" ") || "",
    url: item.link,
    source: "serpapi",
    confidence: baseConfidence,
  }));
}
