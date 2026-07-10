// aurelius/compiled/cache.ts
//
// Phase 4.5 — Cache layer for ReasoningCacheEntry.
// Domain-agnostic CRUD. Callers use these functions, not Prisma directly.

import { prisma } from "../core/db/prisma.ts";
import type {
  ReasoningCacheEntryShape,
  CacheLookupArgs,
  CacheWriteArgs,
  TaggedSignature,
} from "./types.ts";
import { similarityScore, fingerprintMatch } from "./similarity.ts";
import { embedSourceSafe } from "../retrieval/embedPipeline.ts";

/**
 * Find the most similar cached reasoning above the similarity threshold.
 * Returns null if no match meets the threshold.
 *
 * Strategy:
 * 1. Pre-filter by operator + domain + entityKey (and optionally externalScopeId)
 * 2. Fast fingerprint match (exact)
 * 3. If no exact match, score similarity across candidates
 * 4. Return highest-scoring entry above threshold
 * 5. Bump usageCount on hit
 */
export async function lookupCache(
  args: CacheLookupArgs
): Promise<{ entry: ReasoningCacheEntryShape; score: number } | null> {
  const threshold = args.similarityThreshold ?? 0.85;

  const where: any = {
    operatorId: args.operatorId,
    domain: args.domain,
    entityKey: args.entityKey,
  };
  if (args.externalScopeId) where.externalScopeId = args.externalScopeId;

  const candidates = await prisma.reasoningCacheEntry.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  if (candidates.length === 0) return null;

  // Fast path: fingerprint match
  for (const c of candidates) {
    const candidateSig = c.situationSignature as TaggedSignature;
    if (fingerprintMatch(args.signature, candidateSig)) {
      await prisma.reasoningCacheEntry.update({
        where: { id: c.id },
        data: { usageCount: { increment: 1 } },
      });
      return { entry: entryToShape(c), score: 1 };
    }
  }

  // Slow path: similarity score
  let best: { entry: any; score: number } | null = null;
  for (const c of candidates) {
    const candidateSig = c.situationSignature as TaggedSignature;
    const score = similarityScore(args.signature, candidateSig);
    if (score >= threshold && (best === null || score > best.score)) {
      best = { entry: c, score };
    }
  }

  if (!best) return null;

  await prisma.reasoningCacheEntry.update({
    where: { id: best.entry.id },
    data: { usageCount: { increment: 1 } },
  });

  return { entry: entryToShape(best.entry), score: best.score };
}

export async function writeCache(
  args: CacheWriteArgs
): Promise<ReasoningCacheEntryShape> {
  const created = await prisma.reasoningCacheEntry.create({
    data: {
      operatorId: args.operatorId,
      domain: args.domain,
      entityKey: args.entityKey,
      externalScopeId: args.externalScopeId,
      subContext: args.subContext ?? null,
      situationSignature: args.signature as any,
      reasoningSummary: args.reasoningSummary,
      sourceMemoryIds: args.sourceMemoryIds ?? [],
      usageCount: 0,
      previousTags: [],
    },
  });

  // Phase 4.6: reasoning summaries index for semantic recall.
  // Skip empty summaries (failed parses write those) — no signal to index.
  if (args.reasoningSummary && args.reasoningSummary.trim().length > 0) {
    embedSourceSafe({
      sourceType: "reasoning_cache",
      sourceId: created.id,
      text: args.reasoningSummary,
      operatorId: args.operatorId,
      domain: args.domain,
    });
  }

  return entryToShape(created);
}

export async function listCacheForEntity(args: {
  operatorId: string;
  domain: string;
  entityKey: string;
  limit?: number;
}): Promise<ReasoningCacheEntryShape[]> {
  const entries = await prisma.reasoningCacheEntry.findMany({
    where: {
      operatorId: args.operatorId,
      domain: args.domain,
      entityKey: args.entityKey,
    },
    orderBy: { createdAt: "desc" },
    take: args.limit ?? 50,
  });
  return entries.map(entryToShape);
}

function entryToShape(raw: any): ReasoningCacheEntryShape {
  return {
    id: raw.id,
    operatorId: raw.operatorId,
    domain: raw.domain,
    entityKey: raw.entityKey,
    externalScopeId: raw.externalScopeId,
    subContext: raw.subContext,
    situationSignature: raw.situationSignature,
    reasoningSummary: raw.reasoningSummary,
    sourceMemoryIds: (raw.sourceMemoryIds as string[]) ?? [],
    usageCount: raw.usageCount ?? 0,
    previousTags: (raw.previousTags as any[]) ?? [],
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}
