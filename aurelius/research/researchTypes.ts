// aurelius/research/researchTypes.ts

export type ResearchSource = "bing" | "serpapi" | "llm" | "embedding";

export type ResearchResult = {
  title: string;
  snippet: string;
  url?: string;
  source: ResearchSource;
  confidence: number;
};

export type ResearchTask = {
  query: string;
  operator: string;
  depth: "shallow" | "medium" | "deep";
};

export type FusedInsight = {
  insight: string;
  confidence: number;
  supportingSources: ResearchResult[];
};
