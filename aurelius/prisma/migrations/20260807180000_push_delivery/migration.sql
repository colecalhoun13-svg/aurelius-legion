-- Push-delivery persistence (6.5): BridgeSignal.pushedAt records when a Telegram
-- push actually landed, so a dropped push on a critical ask is queryable.
--
-- The `DROP INDEX "VectorEmbedding_embedding_hnsw_idx"` block prisma emits is
-- EXCISED (CLAUDE.md gotcha) — the HNSW index is SQL-only and must survive.

-- AlterTable
ALTER TABLE "BridgeSignal" ADD COLUMN     "pushedAt" TIMESTAMP(3);
