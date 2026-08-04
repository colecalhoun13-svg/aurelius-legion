// aurelius/research/researchConfig.ts

export const researchConfig = {
  depthLevels: {
    shallow: 3,
    medium: 6,
    deep: 10,
  },

  operatorDepthBias: {
    strategy: "deep",
    business: "deep",
    wealth: "deep",
    athlete: "medium",
    training: "medium",
    content: "medium",
    identity: "shallow",
  },

  uncertaintyThreshold: 0.35,
  contradictionThreshold: 0.4,

  providers: {
    // Bing is gone: Microsoft retired the Search APIs in Aug 2025 and no key
    // can revive them. Live web now runs through web/webSearch.ts (Tavily or
    // Gemini grounding) as research Tier 2.
    serpapi: {
      enabled: true,
      // BOTH spellings. The engine read SERPAPI_KEY and this file read
      // SERP_API_KEY, so the tier was unsatisfiable: set the documented name
      // and it enabled itself with an empty key, returning nothing forever.
      apiKey: (process.env.SERPAPI_KEY || process.env.SERP_API_KEY || "").trim(),
    },
  },
};
