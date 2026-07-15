// aurelius/compiled/reasoningHelper.ts
//
// Phase 4.5 — Reasoning-with-compilation helper.
// Generic flow ANY operator uses for Pass 2-style reasoning grounded in
// Compiled Understanding.

import { prisma } from "../core/db/prisma.ts";
import { lookupCache, writeCache } from "./cache.ts";
import { detectPatterns } from "./detector.ts";
import type {
  TaggedSignature,
  SignatureBuilderFn,
  ReasoningCacheEntryShape,
  CompiledPatternShape,
  PatternStatus,
} from "./types.ts";

export type GroundedReasoningContext<TInput = any> = {
  rawInput: TInput;
  signature: TaggedSignature;
  cacheHit: {
    entry: ReasoningCacheEntryShape;
    score: number;
  } | null;
  patterns: CompiledPatternShape[];
};

export type ReasoningFnResult = {
  reasoningSummary: string;
  sourceMemoryIds?: string[];
  [extra: string]: any;
};

export type ReasoningFn<
  TInput = any,
  TResult extends ReasoningFnResult = ReasoningFnResult
> = (context: GroundedReasoningContext<TInput>) => Promise<TResult>;

export type ReasonWithCompilationArgs<
  TInput = any,
  TResult extends ReasoningFnResult = ReasoningFnResult
> = {
  operatorId: string;
  domain: string;
  entityKey: string;
  externalScopeId: string;
  subContext?: string;
  rawInput: TInput;
  signatureBuilder: SignatureBuilderFn<TInput>;
  reasoningFn: ReasoningFn<TInput, TResult>;
  similarityThreshold?: number;
  factualThreshold?: number;
  heuristicThreshold?: number;
  skipPatternDetection?: boolean;
};

export type ReasonWithCompilationResult<
  TResult extends ReasoningFnResult = ReasoningFnResult
> = {
  result: TResult;
  cacheHit: boolean;
  cacheHitScore: number | null;
  patternsConsulted: CompiledPatternShape[];
  patternsDetected: CompiledPatternShape[];
  cacheEntryId: string;
  llmCallsAvoided: number;         // v1 always 0; future: 1 if cache hit skipped LLM
};

/**
 * Generic compilation-aware reasoning flow.
 *
 * 1. Build tagged signature (operator's signature builder)
 * 2. Cache lookup — prior reasoning for similar situation?
 * 3. Pattern lookup — relevant compiled patterns?
 * 4. Assemble grounded context (raw + signature + cache + patterns)
 * 5. Call operator's reasoning function with grounded context
 * 6. Write new cache entry with result
 * 7. Trigger pattern detection on new entry
 */
export async function reasonWithCompilation<
  TInput = any,
  TResult extends ReasoningFnResult = ReasoningFnResult
>(
  args: ReasonWithCompilationArgs<TInput, TResult>
): Promise<ReasonWithCompilationResult<TResult>> {
  // 1. Signature
  const signature = await Promise.resolve(args.signatureBuilder(args.rawInput));

  // 2. Cache lookup
  const cacheHit = await lookupCache({
    operatorId: args.operatorId,
    domain: args.domain,
    entityKey: args.entityKey,
    externalScopeId: args.externalScopeId,
    signature,
    similarityThreshold: args.similarityThreshold,
  });

  // 3. Pattern lookup
  const patternsConsulted = await fetchRelevantPatterns({
    operatorId: args.operatorId,
    domain: args.domain,
    entityKey: args.entityKey,
  });

  // 4. Grounded context
  const groundedContext: GroundedReasoningContext<TInput> = {
    rawInput: args.rawInput,
    signature,
    cacheHit,
    patterns: patternsConsulted,
  };

  // 5. Reasoning
  const result = await args.reasoningFn(groundedContext);

  // 6. Cache write
  const cacheEntry = await writeCache({
    operatorId: args.operatorId,
    domain: args.domain,
    entityKey: args.entityKey,
    externalScopeId: args.externalScopeId,
    subContext: args.subContext,
    signature,
    reasoningSummary: result.reasoningSummary,
    sourceMemoryIds: result.sourceMemoryIds,
  });

  // 7. Pattern detection
  let patternsDetected: CompiledPatternShape[] = [];
  if (!args.skipPatternDetection) {
    try {
      patternsDetected = await detectPatterns({
        operatorId: args.operatorId,
        domain: args.domain,
        entityKey: args.entityKey,
        signature,
        factualThreshold: args.factualThreshold,
        heuristicThreshold: args.heuristicThreshold,
      });
    } catch (err) {
      console.error("[reasoningHelper] pattern detection failed (non-fatal):", err);
    }
  }

  return {
    result,
    cacheHit: cacheHit !== null,
    cacheHitScore: cacheHit?.score ?? null,
    patternsConsulted,
    patternsDetected,
    cacheEntryId: cacheEntry.id,
    llmCallsAvoided: 0,
  };
}

// Only surface auto_factual + confirmed_heuristic patterns during reasoning.
// Proposed and discarded patterns don't influence reasoning.
async function fetchRelevantPatterns(args: {
  operatorId: string;
  domain: string;
  entityKey: string;
}): Promise<CompiledPatternShape[]> {
  const usableStatuses: PatternStatus[] = ["auto_factual", "confirmed_heuristic"];

  const patterns = await prisma.compiledPattern.findMany({
    where: {
      operatorId: args.operatorId,
      domain: args.domain,
      OR: [
        { entityKey: args.entityKey },
        { entityKey: null },  // cross-entity patterns also apply
      ],
      status: { in: usableStatuses },
    },
    orderBy: { confidenceScore: "desc" },
    take: 20,
  });

  return patterns.map((p: any) => ({
    id: p.id,
    operatorId: p.operatorId,
    domain: p.domain,
    entityKey: p.entityKey,
    externalScopeId: p.externalScopeId,
    patternType: p.patternType,
    patternSignature: p.patternSignature,
    conditions: p.conditions,
    status: p.status,
    evidence: (p.evidence as string[]) ?? [],
    supportCount: p.supportCount ?? 0,
    confidenceScore: p.confidenceScore ?? 0,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  }));
}

/**
 * Surface an operator's compiled patterns for the MAIN reasoning brain —
 * everyday chat, not just the training reasoner. Previously confirmed
 * heuristics reached the model ONLY through reasonWithCompilation() (training),
 * so the learning loop compounded in one room of the house: Aurelius detected
 * and stored patterns it never actually reasoned from when Cole talked to it.
 * This closes that loop. Returns the highest-confidence usable patterns for the
 * operator, formatted as a prompt block, or "" when there are none yet.
 */
export async function loadOperatorPatternsForPrompt(args: {
  operatorId: string;
  limit?: number;
  role?: "primary" | "secondary";
  query?: string; // when set, FIT-RANK to this decision, not raw confidence
}): Promise<string> {
  const usableStatuses: PatternStatus[] = ["auto_factual", "confirmed_heuristic"];
  // Fetch a wider set, then rank down BY FIT to the decision on the table — the
  // frameworks that matter are the ones this decision triggers, not the operator's
  // most-confident in general (a lens you didn't select for the cut can only be
  // name-dropped). Falls back to confidence when there's no query.
  let patterns = await prisma.compiledPattern.findMany({
    where: { operatorId: args.operatorId, status: { in: usableStatuses } },
    orderBy: { confidenceScore: "desc" },
    take: 40,
  });
  if (patterns.length === 0) return "";

  const limit = args.limit ?? 10;
  if (args.query && args.query.trim()) {
    const q = fitTokens(args.query);
    patterns = [...patterns]
      .sort((a, b) => fitScore(b, q) - fitScore(a, q) || (b.confidenceScore ?? 0) - (a.confidenceScore ?? 0))
      .slice(0, limit);
  } else {
    patterns = patterns.slice(0, limit);
  }

  const roleTag = args.role === "secondary" ? " · secondary lens" : "";
  const lines: string[] = [`═══ COMPILED FRAMEWORKS${roleTag} (learned — reason THROUGH these) ═══`];
  for (const p of patterns) {
    // Render the RULE, stripped of its citation — the point of activation over
    // retrieval is that the lens acts without announcing which book it came from
    // (rendering "source: The Art of War" invites the name-drop). Provenance stays
    // in the DB for audit, out of the reasoning surface.
    const rule = renderRule(p.patternSignature);
    if (rule) lines.push(`- ${rule}`);
  }
  lines.push("");
  lines.push(
    "These are frameworks you compiled from Cole's canon and his own decisions. Apply their LOGIC to his specific situation — RUN the reasoning, don't restate the rule. Where two point opposite ways, name the tension and say which one governs here and why — don't average them."
  );
  return lines.join("\n");
}

// The rule text, citation stripped. Prefers the distilled theme; else summarizes
// the signature excluding the `source` field.
function renderRule(sig: any): string {
  if (sig && typeof sig === "object" && typeof sig.recurringReasoningTheme === "string") {
    return sig.recurringReasoningTheme.trim();
  }
  if (typeof sig !== "object" || sig === null) return "";
  const parts: string[] = [];
  for (const [key, value] of Object.entries(sig)) {
    if (key === "source" || value === null || value === undefined) continue;
    parts.push(typeof value === "object" ? `${key}: ${JSON.stringify(value).slice(0, 80)}` : `${key}: ${value}`);
  }
  return parts.join(", ");
}

const FIT_STOP = new Set(["the", "and", "for", "that", "with", "should", "would", "when", "this", "your", "you", "have", "are", "was", "his", "her", "them", "into", "from", "what", "how", "why"]);
function fitTokens(s: string): Set<string> {
  return new Set(s.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 3 && !FIT_STOP.has(w)));
}
function fitScore(p: { patternSignature: any }, q: Set<string>): number {
  const text = renderRule(p.patternSignature).toLowerCase();
  let n = 0;
  for (const t of q) if (text.includes(t)) n++;
  return n;
}

/**
 * Format grounded context as a prompt-ready string.
 * Operators inline this into their LLM prompt.
 */
export function formatGroundedContextForPrompt(
  context: GroundedReasoningContext
): string {
  const lines: string[] = [];

  if (context.cacheHit) {
    lines.push("═══ PRIOR REASONING FOR SIMILAR SITUATIONS ═══");
    lines.push(`Similarity score: ${(context.cacheHit.score * 100).toFixed(0)}%`);
    lines.push(`Prior conclusion: ${context.cacheHit.entry.reasoningSummary}`);
    lines.push("");
    lines.push("Treat as STARTING CONTEXT, not blind reuse. Update based on new data.");
    lines.push("");
  }

  if (context.patterns.length > 0) {
    lines.push("═══ COMPILED PATTERNS (accumulated understanding) ═══");
    for (const p of context.patterns) {
      const conf = (p.confidenceScore * 100).toFixed(0);
      lines.push(`- [${p.patternType} · ${p.status} · ${conf}% confidence · ${p.supportCount} instances]`);
      if (typeof p.patternSignature === "object" && p.patternSignature !== null) {
        const summary = summarizePatternSignature(p.patternSignature);
        if (summary) lines.push(`  ${summary}`);
      }
    }
    lines.push("");
    lines.push("Ground your reasoning in these patterns where they apply.");
    lines.push("");
  }

  return lines.join("\n");
}

function summarizePatternSignature(sig: any): string {
  if (typeof sig !== "object" || sig === null) return "";
  const parts: string[] = [];
  for (const [key, value] of Object.entries(sig)) {
    if (value === null || value === undefined) continue;
    if (typeof value === "object") {
      parts.push(`${key}: ${JSON.stringify(value).slice(0, 80)}`);
    } else {
      parts.push(`${key}: ${value}`);
    }
  }
  return parts.join(", ");
}
