// aurelius/retrieval/reindex.ts
//
// AUTO RE-INDEX ON PROVIDER CHANGE. The vector index is derived data keyed by
// embedding MODEL — switching EMBEDDINGS_PROVIDER (e.g. mock → gemini) orphans
// every existing vector, so all of Cole's memories and knowledge become
// invisible to recall until they're re-embedded under the new model. The manual
// fix is `scripts/backfillEmbeddings.ts --force`, awkward on a hosted deploy.
//
// This runs that automatically, at boot, EXACTLY ONCE per provider change:
// a system-scope signature marker records which provider/model the index was
// last built for; when it doesn't match the live adapter, a force re-embed runs
// IN THE BACKGROUND (never blocks boot / the health check) and the marker is
// written on success. Never re-indexes into "mock" (no point embedding into
// noise), and a module-level guard prevents concurrent runs.

import { prisma } from "../core/db/prisma.ts";
import { embedSource } from "./embedPipeline.ts";
import { getEmbeddingAdapter } from "./embeddingAdapter.ts";
import { countEmbeddings } from "./vectorStore.ts";

const SIGNATURE_SCOPE = "system";
const SIGNATURE_KEY = "embeddings.index_signature";

async function globalOperatorId(): Promise<string | null> {
  const { resolveOperatorId } = await import("../knowledge/store.ts");
  return resolveOperatorId("global").catch(() => null);
}

async function readSignature(): Promise<string | null> {
  const row = await prisma.knowledgeEntry.findFirst({
    where: { scope: SIGNATURE_SCOPE, key: SIGNATURE_KEY, active: true },
  });
  return typeof row?.value === "string" ? row.value : null;
}

async function writeSignature(signature: string): Promise<void> {
  const opId = await globalOperatorId();
  if (!opId) return;
  // Raw upsert (scope "system" is deliberately never routed through setKnowledge,
  // so it's never embedded — the G1 rule 6 guard).
  await prisma.knowledgeEntry.upsert({
    where: { operatorId_scope_key: { operatorId: opId, scope: SIGNATURE_SCOPE, key: SIGNATURE_KEY } },
    update: { value: signature as any, updatedBy: "system", active: true },
    create: { operatorId: opId, scope: SIGNATURE_SCOPE, key: SIGNATURE_KEY, value: signature as any, sourceType: "reindex_marker", createdBy: "system" },
  }).catch((err) => console.warn("[reindex] could not persist signature:", (err as any)?.message ?? err));
}

/**
 * Re-embed every source row (knowledge, memory, reasoning cache) under the live
 * provider. `force` re-embeds rows that already have a vector (needed on a
 * provider switch — their old-model vectors are wrong). Mirrors the backfill
 * script so the two can't drift.
 */
export async function reembedAll(opts: { force?: boolean } = {}): Promise<{ embedded: number; skipped: number; failed: number; total: number }> {
  const force = opts.force ?? false;
  const adapter = getEmbeddingAdapter();
  if (!adapter) throw new Error("no embedding provider configured");

  const existing = async (sourceType: string): Promise<Set<string>> => {
    if (force) return new Set<string>();
    const rows: any[] = await prisma.$queryRawUnsafe(
      `SELECT DISTINCT "sourceId" FROM "VectorEmbedding" WHERE "sourceType" = $1`,
      sourceType
    );
    return new Set(rows.map((r) => r.sourceId as string));
  };

  let embedded = 0, skipped = 0, failed = 0;

  // Knowledge — NEVER scope "system" (tokens/cursors live there; rule 6).
  const kDone = await existing("knowledge_entry");
  const knowledge = await prisma.knowledgeEntry.findMany({ where: { active: true, scope: { not: "system" } } });
  for (const k of knowledge) {
    if (kDone.has(k.id)) { skipped++; continue; }
    const valueStr = typeof k.value === "string" ? k.value : JSON.stringify(k.value);
    const text = [`${k.scope}.${k.key}: ${valueStr}`, k.rationale ? `rationale: ${k.rationale}` : ""].filter(Boolean).join(" — ");
    try { embedded += await embedSource({ sourceType: "knowledge_entry", sourceId: k.id, text, operatorId: k.operatorId, domain: k.scope }); }
    catch (err: any) { failed++; console.warn(`[reindex] knowledge ${k.scope}.${k.key}: ${err?.message ?? err}`); }
  }

  const mDone = await existing("memory");
  const memories = await prisma.memory.findMany({ take: 5000, orderBy: { createdAt: "desc" } });
  for (const m of memories) {
    if (mDone.has(m.id)) { skipped++; continue; }
    try { embedded += await embedSource({ sourceType: "memory", sourceId: m.id, text: `[${m.category}] ${m.value}`, operatorId: m.operatorId }); }
    catch (err: any) { failed++; console.warn(`[reindex] memory ${m.id}: ${err?.message ?? err}`); }
  }

  const cDone = await existing("reasoning_cache");
  const cache = await prisma.reasoningCacheEntry.findMany({ take: 5000, orderBy: { createdAt: "desc" } });
  for (const c of cache) {
    if (cDone.has(c.id)) { skipped++; continue; }
    if (!c.reasoningSummary || !c.reasoningSummary.trim()) { skipped++; continue; }
    try { embedded += await embedSource({ sourceType: "reasoning_cache", sourceId: c.id, text: c.reasoningSummary, operatorId: c.operatorId, domain: c.domain }); }
    catch (err: any) { failed++; console.warn(`[reindex] cache ${c.id}: ${err?.message ?? err}`); }
  }

  const total = await countEmbeddings();
  return { embedded, skipped, failed, total };
}

/** Stamp the index marker for the live provider — call after a successful
 *  re-embed (auto or the manual backfill script) so the boot guard agrees. */
export async function markIndexedForCurrentProvider(): Promise<void> {
  const adapter = getEmbeddingAdapter();
  if (!adapter || adapter.name === "mock") return;
  await writeSignature(`${adapter.name}:${adapter.model}:${adapter.dims}`);
}

let running = false;

/**
 * Boot guard: if the live provider differs from what the index was last built
 * for, kick off a background force re-embed and update the marker on success.
 * Fire-and-forget — call it after the server is listening; it never blocks.
 */
export async function ensureIndexMatchesProvider(): Promise<void> {
  if (running) return;
  const adapter = getEmbeddingAdapter();
  // Nothing to do without a real provider. Never re-index into mock (it would
  // just replace orphaned vectors with meaningless ones).
  if (!adapter || adapter.name === "mock") {
    console.log(`[reindex] skipping auto-reindex (provider: ${adapter?.name ?? "none"}).`);
    return;
  }
  const signature = `${adapter.name}:${adapter.model}:${adapter.dims}`;

  let marker: string | null = null;
  try { marker = await readSignature(); } catch { /* first run / no marker */ }
  if (marker === signature) {
    console.log(`[reindex] index already built for ${signature} — nothing to do.`);
    return;
  }

  running = true;
  console.log(`[reindex] provider changed (was ${marker ?? "none"}, now ${signature}) — force re-embedding in the background…`);
  // Detach: don't hold up boot. A long re-embed runs while Aurelius serves.
  (async () => {
    try {
      const r = await reembedAll({ force: true });
      await writeSignature(signature);
      console.log(`[reindex] done: ${r.embedded} chunks embedded, ${r.failed} failed, ${r.total} vectors total (now indexed for ${signature}).`);
    } catch (err: any) {
      console.warn(`[reindex] background re-embed failed (will retry next boot):`, err?.message ?? err);
    } finally {
      running = false;
    }
  })();
}
