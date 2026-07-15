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
  query?: string; // when set, FIT-RANK to this decision by situation, not raw confidence
}): Promise<string> {
  const usableStatuses: PatternStatus[] = ["auto_factual", "confirmed_heuristic"];
  const limit = args.limit ?? 10;

  // Candidate pool: usable patterns by confidence. This is the fallback ordering
  // AND the metadata source (confidence, provenance) for the fit ranking below.
  let pool = await prisma.compiledPattern.findMany({
    where: { operatorId: args.operatorId, status: { in: usableStatuses } },
    orderBy: { confidenceScore: "desc" },
    take: 40,
  });
  if (pool.length === 0) return "";

  // FIT by SITUATION, not shared words: cosine the decision against each heuristic's
  // when-clause. A rule loads because its precondition matches the decision's shape.
  // Cole-derived heuristics (his own corrections) get a small close-call bonus — his
  // judgment is the one lens the frozen model can't contain. Falls back to confidence
  // order only when there's no embedding engine (honest, not the old broken lexical).
  let patterns = pool;
  if (args.query && args.query.trim()) {
    const { retrieveFitPatterns, isColeDerived, COLE_BONUS } = await import("./patternIndex.ts");
    const fit = await retrieveFitPatterns({ operatorId: args.operatorId, query: args.query, limit: 40 });
    if (fit) {
      // Union: a strong semantic match outside the confidence-top-40 still surfaces.
      const have = new Set(pool.map((p) => p.id));
      const missingIds = fit.map((f) => f.id).filter((id) => !have.has(id));
      if (missingIds.length) {
        const extra = await prisma.compiledPattern.findMany({
          where: { id: { in: missingIds }, operatorId: args.operatorId, status: { in: usableStatuses } },
        });
        pool = [...pool, ...extra];
      }
      const scoreById = new Map(fit.map((f) => [f.id, f.score]));
      patterns = [...pool]
        .map((p) => {
          const sem = scoreById.get(p.id) ?? 0; // unindexed/no-match → 0, kept as confidence tail
          const cole = isColeDerived(p.patternSignature, p.evidence as string[]) ? COLE_BONUS : 0;
          const conf = (p.confidenceScore ?? 0) * 0.001; // epsilon tie-break, never dominates
          return { p, rank: sem + cole + conf };
        })
        .sort((a, b) => b.rank - a.rank)
        .slice(0, limit)
        .map((x) => x.p);
    } else {
      patterns = pool.slice(0, limit); // no embedding engine → confidence order
    }
  } else {
    patterns = pool.slice(0, limit);
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
