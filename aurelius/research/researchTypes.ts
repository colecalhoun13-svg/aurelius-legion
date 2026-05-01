// aurelius/research/researchTypes.ts

export type ResearchSource = "bing" | "serpapi" | "llm" | "embedding";

export type ResearchResult = {
  title: string;
  snippet: string;
  url?: string;
  source: ResearchSource;
  confidence: number;
};

/**
 * Research task input.
 * `depth` and `autonomyMode` are optional — runResearch fills sane defaults.
 * `secondaryOperators` enables multi-operator tagging (research findings
 * surface for both primary and related operators).
 */
export type ResearchTask = {
  query: string;
  operator: string;
  depth?: "shallow" | "medium" | "deep";
  autonomyMode?: string;
  secondaryOperators?: string[];
};

export type FusedInsight = {
  insight: string;
  confidence: number;
  supportingSources: ResearchResult[];
};

/**
 * Structured research output produced by the engine.
 * Synthesis is the headline finding. Insights are discrete takeaways.
 * Contradictions are claims in the data that conflict with each other.
 * All three persist to memory as separate entries with metadata.subtype tags.
 */
export type ResearchOutput = {
  query: string;
  synthesis: string;             // 1-3 sentence high-level finding
  insights: string[];            // discrete points, 3-7 typically
  contradictions: string[];      // optional — conflicts noticed in the data
  rawResults: ResearchResult[];  // unfused inputs (for audit)
  savedMemoryIds: string[];      // memories created by this research run
};