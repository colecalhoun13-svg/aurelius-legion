// aurelius/knowledge/store.ts
//
// Phase 4.5a — Living Knowledge CRUD layer.
//
// All read/write operations on KnowledgeEntry go through here. Callers
// never touch Prisma directly. This keeps provenance handling, history
// preservation, and version increments in one place.

import { prisma } from "../core/db/prisma.ts";
import type {
  KnowledgeEntryShape,
  KnowledgeUpdateInput,
  KnowledgeQueryInput,
  KnowledgeHistoryEntry,
  KnowledgeSourceType,
} from "./types.ts";
import { embedSourceSafe } from "../retrieval/embedPipeline.ts";

// Phase 4.6: knowledge entries index for semantic recall on every write.
// Text = human-readable rendering of scope.key + value + rationale.
function indexKnowledgeEntry(entry: KnowledgeEntryShape): void {
  const valueStr =
    typeof entry.value === "string" ? entry.value : JSON.stringify(entry.value);
  const text = [
    `${entry.scope}.${entry.key}: ${valueStr}`,
    entry.rationale ? `rationale: ${entry.rationale}` : "",
  ]
    .filter(Boolean)
    .join(" — ");
  embedSourceSafe({
    sourceType: "knowledge_entry",
    sourceId: entry.id,
    text,
    operatorId: entry.operatorId,
    domain: entry.scope,
  });
}

// ═══════════════════════════════════════════════════════════════════
// READS
// Phase 4.5 Block 6: reads are LAYERED — operator-specific entries win,
// the reserved "global" operator's entries fill the gaps. Callers that
// want ONLY operator-specific data pass skipGlobalFallback: true.
// ═══════════════════════════════════════════════════════════════════

let _cachedGlobalOperatorId: string | null | undefined = undefined;

async function getGlobalOperatorId(): Promise<string | null> {
  if (_cachedGlobalOperatorId !== undefined) return _cachedGlobalOperatorId;
  try {
    const op = await prisma.operator.findUnique({
      where: { name: "global" },
      select: { id: true },
    });
    _cachedGlobalOperatorId = op?.id ?? null;
  } catch (err) {
    console.warn("[knowledge/store] could not resolve global operator:", err);
    _cachedGlobalOperatorId = null;
  }
  return _cachedGlobalOperatorId;
}

/**
 * Get a single knowledge entry by operator + scope + key.
 * Falls back to the "global" operator's entry when the operator
 * has none. Returns null if not found or inactive.
 */
export async function getKnowledge(
  operatorId: string,
  scope: string,
  key: string,
  options: { includeInactive?: boolean; skipGlobalFallback?: boolean } = {}
): Promise<KnowledgeEntryShape | null> {
  const ownEntry = await prisma.knowledgeEntry.findUnique({
    where: {
      operatorId_scope_key: { operatorId, scope, key },
    },
  });

  if (ownEntry && (ownEntry.active || options.includeInactive)) {
    return entryToShape(ownEntry);
  }

  if (options.skipGlobalFallback) return null;

  const globalId = await getGlobalOperatorId();
  if (!globalId || globalId === operatorId) return null;

  const globalEntry = await prisma.knowledgeEntry.findUnique({
    where: {
      operatorId_scope_key: { operatorId: globalId, scope, key },
    },
  });
  if (!globalEntry) return null;
  if (!globalEntry.active && !options.includeInactive) return null;

  return entryToShape(globalEntry);
}

/**
 * List knowledge entries for an operator, optionally filtered by scope.
 * Merges in "global" entries the operator doesn't override —
 * operator wins on (scope, key) collision.
 */
export async function listKnowledge(
  query: KnowledgeQueryInput & { skipGlobalFallback?: boolean }
): Promise<KnowledgeEntryShape[]> {
  const where: any = { operatorId: query.operatorId };
  if (query.scope) where.scope = query.scope;
  if (query.key) where.key = query.key;
  if (query.activeOnly !== false) where.active = true;

  const ownEntries = await prisma.knowledgeEntry.findMany({
    where,
    orderBy: [{ scope: "asc" }, { key: "asc" }],
  });

  if (query.skipGlobalFallback) {
    return ownEntries.map(entryToShape);
  }

  const globalId = await getGlobalOperatorId();
  if (!globalId || globalId === query.operatorId) {
    return ownEntries.map(entryToShape);
  }

  const globalWhere: any = { operatorId: globalId };
  if (query.scope) globalWhere.scope = query.scope;
  if (query.key) globalWhere.key = query.key;
  if (query.activeOnly !== false) globalWhere.active = true;

  const globalEntries = await prisma.knowledgeEntry.findMany({
    where: globalWhere,
    orderBy: [{ scope: "asc" }, { key: "asc" }],
  });

  // Operator-priority: skip global entries with matching (scope, key) in operator's
  const ownKeys = new Set(ownEntries.map((e) => `${e.scope}:${e.key}`));
  const mergedGlobal = globalEntries.filter(
    (g) => !ownKeys.has(`${g.scope}:${g.key}`)
  );

  const merged = [...ownEntries, ...mergedGlobal];
  merged.sort((a, b) => {
    if (a.scope !== b.scope) return a.scope < b.scope ? -1 : 1;
    return a.key < b.key ? -1 : 1;
  });

  return merged.map(entryToShape);
}

/**
 * Get all entries within a scope as a Map keyed by `key`.
 * Convenient for callers that want a typed lookup table
 * (e.g. the rep band classifier). Global fallback applies.
 */
export async function getScope<T = any>(
  operatorId: string,
  scope: string,
  options: { includeInactive?: boolean; skipGlobalFallback?: boolean } = {}
): Promise<Map<string, T>> {
  const entries = await listKnowledge({
    operatorId,
    scope,
    activeOnly: !options.includeInactive,
    skipGlobalFallback: options.skipGlobalFallback,
  });

  const result = new Map<string, T>();
  for (const e of entries) {
    result.set(e.key, e.value as T);
  }
  return result;
}

// ═══════════════════════════════════════════════════════════════════
// WRITES
// ═══════════════════════════════════════════════════════════════════

/**
 * Create or update a knowledge entry.
 * - If no entry exists for (operator, scope, key), creates one at version 1.
 * - If one exists, archives the prior value into history[], increments version,
 *   and writes the new value with new provenance.
 * - This is the canonical write path. All updates flow through here.
 */
export async function setKnowledge(
  input: KnowledgeUpdateInput
): Promise<KnowledgeEntryShape> {
  const existing = await prisma.knowledgeEntry.findUnique({
    where: {
      operatorId_scope_key: {
        operatorId: input.operatorId,
        scope: input.scope,
        key: input.key,
      },
    },
  });

  if (!existing) {
    // Create
    const created = await prisma.knowledgeEntry.create({
      data: {
        operatorId: input.operatorId,
        scope: input.scope,
        key: input.key,
        value: input.value,
        sourceType: input.sourceType,
        sourceId: input.sourceId ?? null,
        rationale: input.rationale ?? null,
        createdBy: input.updatedBy,
        updatedBy: input.updatedBy,
        version: 1,
        active: true,
        history: [],
      },
    });
    const shape = entryToShape(created);
    indexKnowledgeEntry(shape);
    return shape;
  }

  // Update — archive old value to history, bump version. OPTIMISTIC CONCURRENCY:
  // two concurrent writers each read version N, each append to the SAME history
  // snapshot, each write N+1 → the second clobbers the first and one revision's
  // history entry vanishes. Guard the write on the version we read (updateMany
  // where version = N); if we lost the race (count 0), re-read and retry.
  let current = existing;
  for (let attempt = 0; attempt < 5; attempt++) {
    const priorEntry: KnowledgeHistoryEntry = {
      value: current.value,
      sourceType: current.sourceType as KnowledgeSourceType,
      sourceId: current.sourceId,
      rationale: current.rationale,
      version: current.version,
      replacedAt: new Date().toISOString(),
      replacedBy: input.updatedBy,
    };

    const res = await prisma.knowledgeEntry.updateMany({
      where: { id: current.id, version: current.version },
      data: {
        value: input.value,
        sourceType: input.sourceType,
        sourceId: input.sourceId ?? null,
        rationale: input.rationale ?? null,
        updatedBy: input.updatedBy,
        version: current.version + 1,
        history: [...(current.history as any[]), priorEntry],
      },
    });

    if (res.count === 1) {
      const updated = await prisma.knowledgeEntry.findUnique({ where: { id: current.id } });
      const shape = entryToShape(updated!);
      indexKnowledgeEntry(shape);
      return shape;
    }

    // Lost the race — someone bumped the version between our read and write.
    const reread = await prisma.knowledgeEntry.findUnique({ where: { id: existing.id } });
    if (!reread) break; // vanished underneath us
    current = reread;
  }
  throw new Error(`setKnowledge: version conflict on ${input.scope}/${input.key} after retries`);
}

/**
 * Soft-disable a knowledge entry (active=false). Preserves all history.
 * Use when an entry should no longer be consulted but historical record
 * needs to remain intact.
 */
export async function deactivateKnowledge(
  operatorId: string,
  scope: string,
  key: string,
  reason: string,
  updatedBy: string
): Promise<KnowledgeEntryShape | null> {
  const existing = await prisma.knowledgeEntry.findUnique({
    where: { operatorId_scope_key: { operatorId, scope, key } },
  });
  if (!existing) return null;

  const priorEntry: KnowledgeHistoryEntry = {
    value: existing.value,
    sourceType: existing.sourceType as KnowledgeSourceType,
    sourceId: existing.sourceId,
    rationale: existing.rationale,
    version: existing.version,
    replacedAt: new Date().toISOString(),
    replacedBy: updatedBy,
  };

  const updated = await prisma.knowledgeEntry.update({
    where: { id: existing.id },
    data: {
      active: false,
      rationale: reason,
      updatedBy,
      version: existing.version + 1,
      history: [...(existing.history as any[]), priorEntry],
    },
  });

  return entryToShape(updated);
}

// ═══════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════

/**
 * Resolve operator name to ID. Convenience for callers who know the name
 * (e.g., "training") but need the ID for queries.
 */
export async function resolveOperatorId(operatorName: string): Promise<string | null> {
  const op = await prisma.operator.findUnique({
    where: { name: operatorName },
    select: { id: true },
  });
  return op?.id ?? null;
}

function entryToShape(raw: any): KnowledgeEntryShape {
  return {
    id: raw.id,
    operatorId: raw.operatorId,
    scope: raw.scope,
    key: raw.key,
    value: raw.value,
    sourceType: raw.sourceType as KnowledgeSourceType,
    sourceId: raw.sourceId,
    rationale: raw.rationale,
    createdBy: raw.createdBy,
    updatedBy: raw.updatedBy,
    version: raw.version,
    active: raw.active,
    history: (raw.history as any[]) ?? [],
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}