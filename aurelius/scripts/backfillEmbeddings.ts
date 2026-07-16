// aurelius/scripts/backfillEmbeddings.ts
//
// Phase 4.6 — Rebuild/backfill the vector index from source tables.
//
// The index is derived data: this script can be run any time, from scratch
// or incrementally. It embeds every KnowledgeEntry, Memory, and
// ReasoningCacheEntry that doesn't already have an embedding row
// (pass --force to re-embed everything, e.g. after switching models).
//
// Run: npx tsx aurelius/scripts/backfillEmbeddings.ts [--force]

import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
const _dir = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(_dir, "../../.env") });
dotenv.config({ path: path.resolve(_dir, "../.env") });

// CLI override: --provider gemini|openai|mock beats whatever .env parsing
// produced. Must run BEFORE the adapter module resolves the provider.
const provFlagIdx = process.argv.indexOf("--provider");
if (provFlagIdx !== -1 && process.argv[provFlagIdx + 1]) {
  process.env.EMBEDDINGS_PROVIDER = process.argv[provFlagIdx + 1];
}

import { prisma } from "../core/db/prisma.ts";
import { embedSource } from "../retrieval/embedPipeline.ts";
import { embeddingsEnabled, getEmbeddingAdapter } from "../retrieval/embeddingAdapter.ts";
import { countEmbeddings } from "../retrieval/vectorStore.ts";

async function existingSourceIds(sourceType: string): Promise<Set<string>> {
  const rows: any[] = await prisma.$queryRawUnsafe(
    `SELECT DISTINCT "sourceId" FROM "VectorEmbedding" WHERE "sourceType" = $1`,
    sourceType
  );
  return new Set(rows.map((r) => r.sourceId as string));
}

async function main() {
  const force = process.argv.includes("--force");

  if (!embeddingsEnabled()) {
    console.error(
      "[backfill] embeddings are disabled (no OPENAI_API_KEY / provider). Nothing to do."
    );
    process.exit(1);
  }

  // Say which provider is live BEFORE burning 70 API calls on the wrong one.
  const adapter = getEmbeddingAdapter()!;
  console.log(`[backfill] provider: ${adapter.name} (${adapter.model}, ${adapter.dims}d)`);

  let embedded = 0;
  let skipped = 0;
  let failed = 0;

  // ── Knowledge entries ──
  // NEVER embed scope="system" rows: that's where OAuth refresh/access tokens
  // live (written with raw prisma, deliberately un-indexed — hard rule 6). A
  // reindex must not stringify a token blob into VectorEmbedding.chunkText, which
  // freshness.ts already excludes for the same reason.
  const knowledgeDone = force ? new Set<string>() : await existingSourceIds("knowledge_entry");
  const knowledge = await prisma.knowledgeEntry.findMany({ where: { active: true, scope: { not: "system" } } });
  for (const k of knowledge) {
    if (knowledgeDone.has(k.id)) { skipped++; continue; }
    const valueStr = typeof k.value === "string" ? k.value : JSON.stringify(k.value);
    const text = [`${k.scope}.${k.key}: ${valueStr}`, k.rationale ? `rationale: ${k.rationale}` : ""]
      .filter(Boolean).join(" — ");
    try {
      embedded += await embedSource({
        sourceType: "knowledge_entry",
        sourceId: k.id,
        text,
        operatorId: k.operatorId,
        domain: k.scope,
      });
    } catch (err: any) {
      failed++;
      console.warn(`[backfill] knowledge ${k.scope}.${k.key}: ${err?.message ?? err}`);
    }
  }

  // ── Memories ──
  const memoryDone = force ? new Set<string>() : await existingSourceIds("memory");
  const memories = await prisma.memory.findMany({ take: 5000, orderBy: { createdAt: "desc" } });
  for (const m of memories) {
    if (memoryDone.has(m.id)) { skipped++; continue; }
    try {
      embedded += await embedSource({
        sourceType: "memory",
        sourceId: m.id,
        text: `[${m.category}] ${m.value}`,
        operatorId: m.operatorId,
      });
    } catch (err: any) {
      failed++;
      console.warn(`[backfill] memory ${m.id}: ${err?.message ?? err}`);
    }
  }

  // ── Reasoning cache ──
  const cacheDone = force ? new Set<string>() : await existingSourceIds("reasoning_cache");
  const cacheEntries = await prisma.reasoningCacheEntry.findMany({
    take: 5000,
    orderBy: { createdAt: "desc" },
  });
  for (const c of cacheEntries) {
    if (cacheDone.has(c.id)) { skipped++; continue; }
    if (!c.reasoningSummary || c.reasoningSummary.trim().length === 0) { skipped++; continue; }
    try {
      embedded += await embedSource({
        sourceType: "reasoning_cache",
        sourceId: c.id,
        text: c.reasoningSummary,
        operatorId: c.operatorId,
        domain: c.domain,
      });
    } catch (err: any) {
      failed++;
      console.warn(`[backfill] cache ${c.id}: ${err?.message ?? err}`);
    }
  }

  const total = await countEmbeddings();
  console.log("=== Backfill result ===");
  console.log(`  Chunks embedded this run: ${embedded}`);
  console.log(`  Sources skipped (already indexed): ${skipped}`);
  console.log(`  Failures: ${failed}`);
  console.log(`  Total vectors in index: ${total}`);
  if (failed > 0) process.exit(1);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[backfill] fatal:", err);
    process.exit(1);
  });
