-- The gym boundary in the schema: "client" (Cole's own business, full machinery)
-- vs "training_only" (recorded athletes — never business machinery).
-- NOTE: the spurious `DROP INDEX "VectorEmbedding_embedding_hnsw_idx"` emitted
-- by migrate diff has been excised per CLAUDE.md.

-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "kind" TEXT NOT NULL DEFAULT 'client';
