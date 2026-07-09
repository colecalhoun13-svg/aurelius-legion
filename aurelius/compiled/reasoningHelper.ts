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
