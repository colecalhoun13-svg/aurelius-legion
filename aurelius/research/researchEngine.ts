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
import { engineUnavailableText } from "../llm/nonAnswer.ts";
import { runLLM } from "../llm/runLLM.ts";
import { saveMemory } from "../memory/memoryService.ts";

// Phase 4.5 — research findings can propose Living Knowledge updates
import { extractDirectives } from "../llm/directiveParser.ts";
import { createProposal } from "../knowledge/proposals.ts";
import { resolveOperatorId } from "../knowledge/store.ts";

// ═══════════════════════════════════════════════════════════════════
// FEATURE FLAGS
// External adapters are gated by API key presence. Missing keys = silent skip.
// ═══════════════════════════════════════════════════════════════════

const FEATURES = {
  // LIVE WEB — the gap deploy triage found: the engine's only web sources
  // were a retired Bing API and a SerpAPI tier whose key was read from two
  // different env var names, so research quietly ran model-only for every
  // non-academic topic. web/webSearch.ts already did this properly (Tavily,
  // or Gemini's Google Search grounding on the key we already have) and was
  // simply never imported here.
  web: !!(process.env.TAVILY_API_KEY?.trim() || process.env.GEMINI_API_KEY?.trim()),
  // One name, matching .env.example. It used to be SERPAPI_KEY here and
  // SERP_API_KEY in researchConfig — impossible to satisfy both, so the tier
  // either never turned on or turned on with an empty key and returned [].
  serp: !!(process.env.SERPAPI_KEY?.trim() || process.env.SERP_API_KEY?.trim()),
  embedding: !!process.env.OPENAI_API_KEY && !!process.env.RESEARCH_EMBEDDINGS_ENABLED,
};

// Fields where the academic databases (arXiv/PubMed/Semantic Scholar/OpenAlex)
// actually help. Humanities/classics (strategy, identity, content) get noise from
// them, so they're skipped there and lean on the LLM tier + (future) web sources.
const ACADEMIC_DOMAINS = new Set(["training", "athlete", "wealth", "business"]);

// ═══════════════════════════════════════════════════════════════════
// LLM ERROR DETECTOR
// Catches API errors, rate limits, and other failure strings so we don't
// persist them as memory content.
// ═══════════════════════════════════════════════════════════════════

function looksLikeLLMError(text: string): boolean {
  if (!text) return true;
  // The keyless/config strings the adapters actually emit ("Anthropic engine is
  // not configured. Missing ANTHROPIC_API_KEY.", "GROQ_API_KEY is not
  // configured.", "All configured LLM providers failed") are matched by the
  // single-source guard — without this, a keyless synthesis got filed as research
  // memory (hard rule 3) and then flowed into wiki synthesis.
  if (engineUnavailableText(text)) return true;
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
): Promise<{ structured: StructuredSynthesis; rawText: string }> {
  // Ground the synthesis in the ACTUAL retrieved evidence, not just titles. Each
  // fused insight carries its source snippet/abstract + provenance — feed those in
  // so the model synthesizes FROM the literature (PubMed/Semantic Scholar/OpenAlex/
  // arXiv abstracts), not only from its own memory. This was the titles-only
  // bottleneck: the abstracts were fetched and then dropped before synthesis.
  const externalSources = fused.flatMap((f) => f.supportingSources).filter((s) => s.source !== "llm");
  const evidenceBlock = fused
    .slice(0, 12)
    .map((f, i) => {
      const s = f.supportingSources[0];
      const snippet = s?.snippet ? ` — ${s.snippet.slice(0, 400)}` : "";
      const prov = s && s.source !== "llm" ? ` [${s.source}${s.url ? `: ${s.url}` : ""}]` : "";
      return `  ${i + 1}. (conf ${f.confidence.toFixed(2)}) ${f.insight}${snippet}${prov}`;
    })
    .join("\n");

  const grounded = externalSources.length > 0;
  const prompt = `
Cole asked you to research: "${task.query}"

Below is retrieved evidence from research sources — each with its abstract/snippet
and provenance. ${grounded
    ? "Synthesize FROM this evidence; ground your claims in it and prefer what the sources actually say over your prior assumptions."
    : "No external sources were retrieved for this topic, so synthesize from your own knowledge — be appropriately measured, and do not fabricate citations."}

Retrieved evidence:
${evidenceBlock || "  (none retrieved — rely on your own knowledge, stated as such)"}

Produce the response in this exact format:

SYNTHESIS: [1-3 sentences capturing the headline finding for Cole]

INSIGHTS:
- [discrete takeaway 1]
- [discrete takeaway 2]
- [3-7 total — only ones with real signal]

CONTRADICTIONS:
- [optional — only include if the data conflicts with itself]

IMPORTANT — KNOWLEDGE UPDATE PROPOSALS:
If any finding has direct implications for Cole's Living Knowledge (rep bands,
intensity zones, movement patterns, block contexts, fatigue signals, or
similar structured taxonomies for this operator), emit a
[KNOWLEDGE_UPDATE_PROPOSE: data={...}] directive AFTER the structured output.
Use the intent classes listed in your guidance. Set coleNaturalLanguage to
the research query itself. Set the rationale to indicate this is
research-derived. Only propose updates that the evidence clearly supports.
If findings don't have taxonomy implications, emit no directives.

Be tactical. No filler. Match Aurelius's voice.
`.trim();

  // Phase 4.5: resolve operatorId so Layer 7.5 fires for research synthesis
  let operatorId: string | null = null;
  try {
    operatorId = await resolveOperatorId(task.operator);
  } catch (err) {
    console.warn("[research] could not resolve operatorId for", task.operator, err);
  }

  const response = await runLLM({
    taskType: "research",
    operators: {
      primary: task.operator,
      secondaries: task.secondaryOperators ?? [],
    },
    input: prompt,
    knowledgeContext: operatorId
      ? { operatorId, operatorName: task.operator }
      : undefined,
  });

  return {
    structured: parseStructuredSynthesis(response.text),
    rawText: response.text,
  };
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
  // Pass the operator so its domain-aware prompt + confidence weighting fire
  // (was defaulting every field to "strategy").
  try {
    const llm = await llmResearch(task.query, task.operator);
    results.push(...llm);
  } catch (err) {
    console.warn("[research] llmResearch failed:", err);
  }

  // ── Tier 1.5: open sources (free, no keys, always on) ──
  // The nine-for-nine fix, three parts:
  //   1. SEARCH THE SUBJECT, not the study prompt — the curriculum's long
  //      "develop a practitioner-grade understanding…" essay prompt was being
  //      sent to arXiv verbatim, which returned physics junk for everything.
  //   2. WORKS route to book sources (Wikipedia/Open Library/Gutenberg) —
  //      paper archives structurally cannot hold books.
  //   3. RELEVANCE GATE — a paper that never mentions the subject is noise,
  //      not evidence, no matter which archive returned it.
  const searchTerm = (task.subject ?? task.query).slice(0, 240);
  if (task.kind === "work") {
    try {
      const { bookSourcesSearch } = await import("./researchAdapters/bookSourcesAdapter.ts");
      results.push(...(await bookSourcesSearch(searchTerm)));
    } catch (err) {
      console.warn("[research] book sources unavailable:", err);
    }
  } else if (ACADEMIC_DOMAINS.has(task.operator)) {
    // arXiv/PubMed/S2/OpenAlex are gold for EMPIRICAL topics but return
    // irrelevant papers for humanities/classics — domain-gated as before.
    try {
      const { openSourcesSearch } = await import("./researchAdapters/openSourcesAdapter.ts");
      const { filterRelevant } = await import("./researchAdapters/relevance.ts");
      const open = await openSourcesSearch(searchTerm, Math.max(2, Math.floor(limit / 3)));
      results.push(...filterRelevant(searchTerm, open, 0.34));
    } catch (err) {
      console.warn("[research] open sources unavailable:", err);
    }
  }

  // ── Tier 2: the live web ──
  // Runs for EVERY research task, not just academic domains — this is the
  // tier that makes "what's actually happening now" answerable, and its
  // absence is what left `grounding: "model-only"` on most runs.
  if (FEATURES.web) {
    try {
      const { webSearch } = await import("../web/webSearch.ts");
      const hit = await webSearch(searchTerm);
      if (hit.answer) {
        results.push({
          title: `Live web search — ${hit.provider}`,
          snippet: hit.answer.slice(0, 2000),
          source: "web",
          confidence: 0.68,
        });
      }
      for (const src of hit.sources.slice(0, Math.max(3, Math.floor(limit / 2)))) {
        results.push({
          title: src.title || src.url,
          snippet: src.title || src.url,
          url: src.url,
          source: "web",
          confidence: 0.55,
        });
      }
    } catch (err) {
      // Honest failure, not a crash: the run continues on the other tiers and
      // reports grounding accordingly.
      console.warn("[research] live web search unavailable:", (err as any)?.message ?? err);
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
  // Pass the operator so its source-weighting fires (was defaulting to "strategy").
  let fused = fuseResearchResults(results, task.operator);
  fused = applyMemoryPolicy(fused, memory);

  // ── Synthesis (LLM produces structured output) ──
  const { structured, rawText: synthesisRawText } = await synthesizeFindings(task, fused);

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
      proposalsCreated: 0,
      grounding: "model-only",
    };
  }

  const grounding: "external" | "model-only" = results.some((r) => r.source !== "llm") ? "external" : "model-only";

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

  // ── Phase 4.5: Extract knowledge update proposals from synthesis ──
  let proposalsCreated = 0;
  try {
    const operatorId = await resolveOperatorId(task.operator);
    if (operatorId) {
      const parsed = extractDirectives(synthesisRawText);
      for (const dir of parsed.knowledgeProposals) {
        const d = dir.data;
        if (!d.intentClassId || !d.scope || !d.key || d.proposedValue === undefined) {
          console.warn("[research] KNOWLEDGE_UPDATE_PROPOSE missing fields:", d);
          continue;
        }
        try {
          await createProposal({
            operatorId,
            operatorName: task.operator,
            intentClassId: d.intentClassId,
            scope: d.scope,
            key: d.key,
            proposedValue: d.proposedValue,
            rationale: d.rationale ?? `Research-derived from query: "${task.query}"`,
            coleNaturalLanguage: d.coleNaturalLanguage ?? task.query,
            origin: "research", // eligible for the knowledge.apply_proposal keyhole
          });
          proposalsCreated++;
        } catch (err) {
          console.error("[research] createProposal failed:", err);
        }
      }
    }
  } catch (err) {
    console.error("[research] knowledge proposal extraction failed (non-fatal):", err);
  }

  return {
    query: task.query,
    synthesis: structured.synthesis,
    insights: structured.insights,
    contradictions: structured.contradictions,
    rawResults: results,
    savedMemoryIds,
    proposalsCreated,
    grounding,
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