// aurelius/compiled/detector.ts
//
// Phase 4.5 — Pattern detection after cache writes.
// After a write, scan cache for similar entries. If enough (≥N), propose
// a CompiledPattern.
//
// Domain-agnostic.
//
// Classification:
// - Factual patterns: N=2 instances → auto_factual (immediately usable)
// - Heuristic patterns: N=3 instances → proposed_heuristic (needs Cole's confirm)

import { prisma } from "../core/db/prisma.ts";
import type {
  PatternDetectionArgs,
  PatternProposal,
  CompiledPatternShape,
  TaggedSignature,
} from "./types.ts";
import { listCacheForEntity } from "./cache.ts";
import { similarityScore } from "./similarity.ts";

export async function detectPatterns(
  args: PatternDetectionArgs
): Promise<CompiledPatternShape[]> {
  const factualThreshold = args.factualThreshold ?? 2;
  const heuristicThreshold = args.heuristicThreshold ?? 3;
  const similarityThreshold = 0.85;

  const candidates = await listCacheForEntity({
    operatorId: args.operatorId,
    domain: args.domain,
    entityKey: args.entityKey,
    limit: 50,
  });

  if (candidates.length < factualThreshold) return [];

  const similar = candidates.filter((c) => {
    const sig = c.situationSignature as TaggedSignature;
    return similarityScore(args.signature, sig) >= similarityThreshold;
  });

  if (similar.length < factualThreshold) return [];

  const proposals: PatternProposal[] = [];

  // Factual pattern check
  if (similar.length >= factualThreshold) {
    const evidenceIds = similar.map((s) => s.id);
    const consistencyScore = computeConsistencyScore(similar);
    if (consistencyScore >= 0.7) {
      proposals.push({
        patternType: "factual",
        patternSignature: extractCommonTags(similar),
        evidenceIds,
        supportCount: similar.length,
        confidenceScore: consistencyScore,
        rationale: `Factual pattern: ${similar.length} similar entries, ${(consistencyScore * 100).toFixed(0)}% tag consistency`,
      });
    }
  }

  // Heuristic pattern check
  if (similar.length >= heuristicThreshold) {
    const reasoningConsistency = computeReasoningConsistency(similar);
    if (reasoningConsistency >= 0.6) {
      proposals.push({
        patternType: "heuristic",
        patternSignature: {
          tags: extractCommonTags(similar),
          recurringReasoningTheme: await extractCommonReasoningTheme(similar),
        },
        evidenceIds: similar.map((s) => s.id),
        supportCount: similar.length,
        confidenceScore: reasoningConsistency,
        rationale: `Heuristic pattern: ${similar.length} similar situations, consistent reasoning theme`,
      });
    }
  }

  if (proposals.length === 0) return [];
  return persistProposals(args.operatorId, args.domain, args.entityKey, proposals);
}

/**
 * HEURISTIC-ONLY detection — for the main chat brain. detectPatterns() gates
 * everything on factualThreshold (its early returns use it as a floor) and would
 * auto-create an unconfirmed `auto_factual` pattern from just 2 similar turns —
 * too eager, and it would steer reasoning without Cole's confirm. Chat needs the
 * opposite: NO auto-facts, only heuristics (≥N similar) that PROPOSE and wait for
 * a Bridge confirm. Same helpers, same persist path, no factual branch.
 */
export async function detectHeuristics(args: {
  operatorId: string;
  domain: string;
  entityKey: string;
  signature: TaggedSignature;
  heuristicThreshold?: number;
}): Promise<CompiledPatternShape[]> {
  const heuristicThreshold = args.heuristicThreshold ?? 3;
  const similarityThreshold = 0.85;

  const candidates = await listCacheForEntity({
    operatorId: args.operatorId,
    domain: args.domain,
    entityKey: args.entityKey,
    limit: 50,
  });
  if (candidates.length < heuristicThreshold) return [];

  const similar = candidates.filter(
    (c) => similarityScore(args.signature, c.situationSignature as TaggedSignature) >= similarityThreshold
  );
  if (similar.length < heuristicThreshold) return [];

  const reasoningConsistency = computeReasoningConsistency(similar);
  if (reasoningConsistency < 0.6) return []; // answers must actually overlap

  const proposal: PatternProposal = {
    patternType: "heuristic",
    patternSignature: {
      tags: extractCommonTags(similar),
      recurringReasoningTheme: await extractCommonReasoningTheme(similar),
    },
    evidenceIds: similar.map((s) => s.id),
    supportCount: similar.length,
    confidenceScore: reasoningConsistency,
    rationale: `Chat heuristic: ${similar.length} similar exchanges, consistent conclusion`,
  };
  return persistProposals(args.operatorId, args.domain, args.entityKey, [proposal]);
}

/** Idempotent upsert of pattern proposals — shared by both detectors. */
async function persistProposals(
  operatorId: string,
  domain: string,
  entityKey: string,
  proposals: PatternProposal[]
): Promise<CompiledPatternShape[]> {
  const persisted: CompiledPatternShape[] = [];
  for (const p of proposals) {
    const status = p.patternType === "factual" ? "auto_factual" : "proposed_heuristic";

    const existing = await prisma.compiledPattern.findFirst({
      where: {
        operatorId,
        domain,
        entityKey,
        patternType: p.patternType,
        status: { in: ["auto_factual", "proposed_heuristic", "confirmed_heuristic"] },
      },
    });

    if (existing) {
      const updated = await prisma.compiledPattern.update({
        where: { id: existing.id },
        data: {
          supportCount: p.supportCount,
          confidenceScore: Math.max(existing.confidenceScore, p.confidenceScore),
          evidence: Array.from(new Set([...(existing.evidence as string[]), ...p.evidenceIds])),
        },
      });
      persisted.push(patternToShape(updated));
      continue;
    }

    const created = await prisma.compiledPattern.create({
      data: {
        operatorId,
        domain,
        entityKey,
        patternType: p.patternType,
        patternSignature: p.patternSignature as any,
        status,
        evidence: p.evidenceIds,
        supportCount: p.supportCount,
        confidenceScore: p.confidenceScore,
      },
    });
    persisted.push(patternToShape(created));
  }
  return persisted;
}

function computeConsistencyScore(entries: any[]): number {
  if (entries.length < 2) return 0;
  let totalScore = 0;
  let comparisons = 0;
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      totalScore += similarityScore(
        entries[i].situationSignature as TaggedSignature,
        entries[j].situationSignature as TaggedSignature
      );
      comparisons++;
    }
  }
  return comparisons > 0 ? totalScore / comparisons : 0;
}

function computeReasoningConsistency(entries: any[]): number {
  // v1: word-overlap (Jaccard). Future: embeddings.
  if (entries.length < 2) return 0;
  const tokenize = (s: string) =>
    new Set(s.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 3));
  let totalOverlap = 0;
  let comparisons = 0;
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const a = tokenize(entries[i].reasoningSummary as string);
      const b = tokenize(entries[j].reasoningSummary as string);
      const intersection = new Set([...a].filter((x) => b.has(x)));
      const union = new Set([...a, ...b]);
      const jaccard = union.size > 0 ? intersection.size / union.size : 0;
      totalOverlap += jaccard;
      comparisons++;
    }
  }
  return comparisons > 0 ? totalOverlap / comparisons : 0;
}

function extractCommonTags(entries: any[]): Record<string, any> {
  if (entries.length === 0) return {};
  const firstTags = (entries[0].situationSignature as TaggedSignature).tags ?? {};
  const common: Record<string, any> = {};
  for (const key of Object.keys(firstTags)) {
    const values = entries.map((e) => (e.situationSignature as TaggedSignature).tags?.[key]);
    const allEqual = values.every((v) => JSON.stringify(v) === JSON.stringify(values[0]));
    if (allEqual) common[key] = values[0];
  }
  return common;
}

// Distill the recurring theme into ONE legible line. This runs only when a
// heuristic actually crosses its threshold (rare), so an LLM call here is cheap —
// and it turns opaque signature JSON into a heuristic Cole can read and confirm.
// Deterministic fallback (the old concat) keeps it working keyless/offline.
async function extractCommonReasoningTheme(entries: any[]): Promise<string> {
  if (entries.length === 0) return "";
  const fallback = entries.map((e) => (e.reasoningSummary as string).slice(0, 80)).join(" | ");
  try {
    const { runLLM } = await import("../llm/runLLM.ts");
    const samples = entries.slice(0, 6).map((e, i) => `${i + 1}. ${(e.reasoningSummary as string).slice(0, 400)}`).join("\n");
    const res = await runLLM({
      taskType: "summary",
      operators: { primary: "strategy", secondaries: [] },
      input:
        `These are ${entries.length} of Aurelius's own conclusions from recurring, similar situations with Cole. ` +
        `Distill the ONE durable heuristic they share — a single sentence Aurelius could reason FROM next time ` +
        `("When Cole ___, he wants ___"). Under 25 words, no preamble, plain statement.\n\n${samples}`,
    });
    const line = (res.text ?? "").trim().replace(/^["'\s]+|["'\s]+$/g, "");
    // Guard: never file an engine-error/empty string as the theme.
    if (line && line.length >= 8 && !/is not configured|All configured LLM providers failed|error/i.test(line)) {
      return line.slice(0, 240);
    }
  } catch (err) {
    console.warn("[detector] theme distillation failed, using concat fallback:", (err as any)?.message ?? err);
  }
  return fallback.slice(0, 240);
}

function patternToShape(raw: any): CompiledPatternShape {
  return {
    id: raw.id,
    operatorId: raw.operatorId,
    domain: raw.domain,
    entityKey: raw.entityKey,
    externalScopeId: raw.externalScopeId,
    patternType: raw.patternType,
    patternSignature: raw.patternSignature,
    conditions: raw.conditions,
    status: raw.status,
    evidence: (raw.evidence as string[]) ?? [],
    supportCount: raw.supportCount ?? 0,
    confidenceScore: raw.confidenceScore ?? 0,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}
