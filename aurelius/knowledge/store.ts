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

// ═══════════════════════════════════════════════════════════════════
// READS
// ═══════════════════════════════════════════════════════════════════

/**
 * Get a single knowledge entry by operator + scope + key.
 * Returns null if not found or inactive.
 */
export async function getKnowledge(
  operatorId: string,
  scope: string,
  key: string,
  options: { includeInactive?: boolean } = {}
): Promise<KnowledgeEntryShape | null> {
  const entry = await prisma.knowledgeEntry.findUnique({
    where: {
      operatorId_scope_key: { operatorId, scope, key },
    },
  });

  if (!entry) return null;
  if (!entry.active && !options.includeInactive) return null;

  return entryToShape(entry);
}

/**
 * List knowledge entries for an operator, optionally filtered by scope.
 */
export async function listKnowledge(
  query: KnowledgeQueryInput
): Promise<KnowledgeEntryShape[]> {
  const where: any = { operatorId: query.operatorId };
  if (query.scope) where.scope = query.scope;
  if (query.key) where.key = query.key;
  if (query.activeOnly !== false) where.active = true;

  const entries = await prisma.knowledgeEntry.findMany({
    where,
    orderBy: [{ scope: "asc" }, { key: "asc" }],
  });

  return entries.map(entryToShape);
}

/**
 * Get all entries within a scope as a Map keyed by `key`.
 * Convenient for callers that want a typed lookup table
 * (e.g. the rep band classifier).
 */
export async function getScope<T = any>(
  operatorId: string,
  scope: string,
  options: { includeInactive?: boolean } = {}
): Promise<Map<string, T>> {
  const entries = await listKnowledge({
    operatorId,
    scope,
    activeOnly: !options.includeInactive,
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
    return entryToShape(created);
  }

  // Update — archive old value to history, bump version
  const priorEntry: KnowledgeHistoryEntry = {
    value: existing.value,
    sourceType: existing.sourceType as KnowledgeSourceType,
    sourceId: existing.sourceId,
    rationale: existing.rationale,
    version: existing.version,
    replacedAt: new Date().toISOString(),
    replacedBy: input.updatedBy,
  };

  const updated = await prisma.knowledgeEntry.update({
    where: { id: existing.id },
    data: {
      value: input.value,
      sourceType: input.sourceType,
      sourceId: input.sourceId ?? null,
      rationale: input.rationale ?? null,
      updatedBy: input.updatedBy,
      version: existing.version + 1,
      history: [...(existing.history as any[]), priorEntry],
    },
  });

  return entryToShape(updated);
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