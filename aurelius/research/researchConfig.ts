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
    bing: {
      enabled: true,
      apiKey: process.env.BING_API_KEY || "",
    },
    serpapi: {
      enabled: true,
      apiKey: process.env.SERP_API_KEY || "",
    },
  },
};
