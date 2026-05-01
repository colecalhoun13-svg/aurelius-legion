// aurelius/research/researchEngine.ts
//
// Aurelius's research engine — external intelligence acquisition.
//
// Architectural role: research is one of three "intelligence amplifiers"
// (operator cores, memory, research). It pulls in information, synthesizes it,
// persists it to memory tagged by operator, and feeds back into operator
// reasoning through the memory retrieval loop.
//
// Phase 2 scope: LLM-based research only. Bing/SerpAPI/embedding adapters
// are feature-flagged (require API keys we don't yet have).
//
// Research → Memory → Operator reasoning. Operator cores stay stable.

import { researchConfig } from "./researchConfig.ts";
import {
  ResearchTask,
  ResearchResult,
  FusedInsight,
  ResearchOutput,
} from "./researchTypes.ts";

import { llmResearch } from "./researchAdapters/llmResearchAdapter.ts";
import { fuseResearchResults } from "./researchFusion.ts";

import { getOperatorProfile } from "../core/operatorProfiles.ts";
import { runLLM } from "../llm/runLLM.ts";
import { saveMemory } from "../memory/memoryService.ts";

// ═══════════════════════════════════════════════════════════════════
// FEATURE FLAGS
// External adapters are gated by API key presence. Missing keys = silent skip.
// ═══════════════════════════════════════════════════════════════════

const FEATURES = {
  bing: !!process.env.BING_API_KEY,
  serp: !!process.env.SERPAPI_KEY,
  embedding: !!process.env.OPENAI_API_KEY && !!process.env.RESEARCH_EMBEDDINGS_ENABLED,
};

// ═══════════════════════════════════════════════════════════════════
// LLM ERROR DETECTOR
// Catches API errors, rate limits, and other failure strings so we don't
// persist them as memory content.
// ═══════════════════════════════════════════════════════════════════

function looksLikeLLMError(text: string): boolean {
  if (!text) return true;
  const lower = text.toLowerCase();
  return (
    lower.includes("api error") ||
    lower.includes("credit balance") ||
    lower.includes("rate limit") ||
    lower.includes("authentication") ||
    lower.includes("unauthorized") ||
    lower.startsWith("error:") ||
    lower.includes("anthropic api error") ||
    lower.includes("openai api error") ||
    lower.includes("groq api error")
  );
}

// ═══════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════

function detectUncertainty(results: ResearchResult[]): number {
  if (!results.length) return 1;
  const avg = results.reduce((a, b) => a + b.confidence, 0) / results.length;
  return 1 - avg;
}

function applyMemoryPolicy(insights: FusedInsight[], memory: any): FusedInsight[] {
  if (!memory) return insights;

  if (memory.retentionBias === "patterns") {
    return insights.filter((i) => i.insight.length > 40);
  }
  if (memory.retentionBias === "tactics") {
    return insights.filter((i) => i.insight.length <= 80);
  }
  if (memory.retentionBias === "decisions") {
    return insights.filter((i) =>
      /should|must|decide|choose|avoid|prefer/i.test(i.insight)
    );
  }

  return insights;
}

// ═══════════════════════════════════════════════════════════════════
// RESEARCH SYNTHESIS
// Takes fused insights and asks an LLM to produce structured output
// (synthesis + discrete insights + contradictions noticed).
// ═══════════════════════════════════════════════════════════════════

type StructuredSynthesis = {
  synthesis: string;
  insights: string[];
  contradictions: string[];
};

async function synthesizeFindings(
  task: ResearchTask,
  fused: FusedInsight[]
): Promise<StructuredSynthesis> {
  const fusedSummary = fused
    .slice(0, 12)
    .map((f, i) => `  ${i + 1}. (conf ${f.confidence.toFixed(2)}) ${f.insight}`)
    .join("\n");

  const prompt = `
Cole asked you to research: "${task.query}"

Below are fused insights from research adapters. Synthesize them into a structured output.

Fused insights:
${fusedSummary || "  (no fused insights — base synthesis only on what you know)"}

Produce the response in this exact format:

SYNTHESIS: [1-3 sentences capturing the headline finding for Cole]

INSIGHTS:
- [discrete takeaway 1]
- [discrete takeaway 2]
- [3-7 total — only ones with real signal]

CONTRADICTIONS:
- [optional — only include if the data conflicts with itself]

Be tactical. No filler. Match Aurelius's voice.
`.trim();

  const response = await runLLM({
    taskType: "research",
    operators: {
      primary: task.operator,
      secondaries: task.secondaryOperators ?? [],
    },
    input: prompt,
  });

  return parseStructuredSynthesis(response.text);
}

function parseStructuredSynthesis(text: string): StructuredSynthesis {
  const result: StructuredSynthesis = {
    synthesis: "",
    insights: [],
    contradictions: [],
  };

  const synthMatch = text.match(/SYNTHESIS:\s*([\s\S]*?)(?=\n\s*INSIGHTS:|$)/i);
  if (synthMatch) result.synthesis = synthMatch[1].trim();

  const insightsMatch = text.match(/INSIGHTS:\s*([\s\S]*?)(?=\n\s*CONTRADICTIONS:|$)/i);
  if (insightsMatch) result.insights = extractBullets(insightsMatch[1]);

  const contraMatch = text.match(/CONTRADICTIONS:\s*([\s\S]*)/i);
  if (contraMatch) result.contradictions = extractBullets(contraMatch[1]);

  // Fallback: no structured fields parsed → treat whole text as synthesis
  if (!result.synthesis && result.insights.length === 0) {
    result.synthesis = text.trim().split("\n")[0] ?? text.trim();
  }

  return result;
}

function extractBullets(block: string): string[] {
  return block
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("-") || line.startsWith("•") || line.startsWith("*"))
    .map((line) => line.replace(/^[-•*]\s*/, "").trim())
    .filter((line) => line.length > 0);
}

// ═══════════════════════════════════════════════════════════════════
// MAIN RUN
// ═══════════════════════════════════════════════════════════════════

export async function runResearch(task: ResearchTask): Promise<ResearchOutput> {
  const profile = getOperatorProfile(task.operator);
  const decision = profile?.decisionProfile;
  const memory = profile?.memoryPolicy;

  // Resolve depth: explicit > operator's depthBias > default "medium"
  let depth: "shallow" | "medium" | "deep" = task.depth ?? "medium";
  if (decision?.depthBias === "deep") depth = "deep";
  if (decision?.depthBias === "shallow") depth = "shallow";
  const limit = researchConfig.depthLevels[depth];

  let results: ResearchResult[] = [];

  // ── Tier 1: LLM research (always available) ──
  try {
    const llm = await llmResearch(task.query);
    results.push(...llm);
  } catch (err) {
    console.warn("[research] llmResearch failed:", err);
  }

  // ── Tier 2: external adapters (feature-flagged) ──
  if (FEATURES.bing) {
    try {
      const { bingSearch } = await import("./researchAdapters/webSearchAdapter.ts");
      const uncertainty = detectUncertainty(results);
      if (uncertainty > researchConfig.uncertaintyThreshold) {
        const bing = await bingSearch(task.query);
        results.push(...bing.slice(0, limit));
      }
    } catch (err) {
      console.warn("[research] bingSearch unavailable:", err);
    }
  }

  if (FEATURES.serp) {
    try {
      const { serpSearch } = await import("./researchAdapters/serpSearchAdapter.ts");
      const contradiction = detectUncertainty(results);
      if (contradiction > researchConfig.contradictionThreshold) {
        const serp = await serpSearch(task.query);
        results.push(...serp.slice(0, limit));
      }
    } catch (err) {
      console.warn("[research] serpSearch unavailable:", err);
    }
  }

  if (FEATURES.embedding) {
    try {
      const { embeddingResearch } = await import("./researchAdapters/embeddingResearchAdapter.ts");
      const embed = await embeddingResearch(task.query);
      results.push(...embed);
    } catch (err) {
      console.warn("[research] embeddingResearch unavailable:", err);
    }
  }

  // ── Fusion + memory policy filter ──
  let fused = fuseResearchResults(results);
  fused = applyMemoryPolicy(fused, memory);

  // ── Synthesis (LLM produces structured output) ──
  const structured = await synthesizeFindings(task, fused);

  // Guard: if the LLM call errored, synthesis will be the error string.
  // Skip persistence entirely — don't pollute memory with API error messages.
  if (looksLikeLLMError(structured.synthesis)) {
    console.warn("[research] LLM error detected, skipping memory persistence:", structured.synthesis);
    return {
      query: task.query,
      synthesis: structured.synthesis,
      insights: [],
      contradictions: [],
      rawResults: results,
      savedMemoryIds: [],
    };
  }

  // ── Persist to memory ──
  // Each artifact saves as its own memory entry, all tagged with operator + relations.
  // This is what enables the "Research → Memory → Operator reasoning" loop.
  const savedMemoryIds: string[] = [];

  // 1. Synthesis (headline finding)
  if (structured.synthesis) {
    try {
      const m = await saveMemory({
        operator: task.operator,
        category: "research",
        value: `${task.query}: ${structured.synthesis}`,
        relatedOperators: task.secondaryOperators,
        metadata: { subtype: "synthesis", query: task.query, depth },
      });
      if (m) savedMemoryIds.push(m.id);
    } catch (err) {
      console.error("[research] failed to save synthesis:", err);
    }
  }

  // 2. Discrete insights
  for (const insight of structured.insights) {
    try {
      const m = await saveMemory({
        operator: task.operator,
        category: "research",
        value: insight,
        relatedOperators: task.secondaryOperators,
        metadata: { subtype: "insight", query: task.query },
      });
      if (m) savedMemoryIds.push(m.id);
    } catch (err) {
      console.error("[research] failed to save insight:", err);
    }
  }

  // 3. Contradictions (if any)
  for (const contradiction of structured.contradictions) {
    try {
      const m = await saveMemory({
        operator: task.operator,
        category: "research",
        value: `Contradiction: ${contradiction}`,
        relatedOperators: task.secondaryOperators,
        metadata: { subtype: "contradiction", query: task.query },
      });
      if (m) savedMemoryIds.push(m.id);
    } catch (err) {
      console.error("[research] failed to save contradiction:", err);
    }
  }

  return {
    query: task.query,
    synthesis: structured.synthesis,
    insights: structured.insights,
    contradictions: structured.contradictions,
    rawResults: results,
    savedMemoryIds,
  };
}

// ═══════════════════════════════════════════════════════════════════
// ENGINE ADAPTER
// ═══════════════════════════════════════════════════════════════════

import type { Engine, EngineInput, EngineContext, EngineResult } from "../core/engineTypes.ts";

export const researchEngineAdapter: Engine = {
  name: "research",
  async run(input: EngineInput, _ctx: EngineContext): Promise<EngineResult> {
    try {
      const startTime = Date.now();

      const result = await runResearch({
        query: input.payload?.query || input.payload?.text || "",
        operator: input.payload?.operator || "strategy",
        depth: input.payload?.depth,
        secondaryOperators: input.payload?.secondaryOperators,
        autonomyMode: input.payload?.autonomyMode,
      });

      const latencyMs = Date.now() - startTime;

      return {
        status: "success",
        summary: result.synthesis || "Research completed",
        text: result.synthesis,
        data: {
          synthesis: result.synthesis,
          insights: result.insights,
          contradictions: result.contradictions,
          savedMemoryIds: result.savedMemoryIds,
          rawResultCount: result.rawResults.length,
        },
        logs: [],
        metrics: { latencyMs },
      };
    } catch (error: any) {
      return {
        status: "error",
        summary: error?.message ?? "Research failed",
        text: error?.message ?? String(error),
        data: {},
        logs: [error?.stack ?? ""],
        metrics: { latencyMs: 0 },
      };
    }
  },
};