-- Content-outcome loop + llm-dependence correctness coupling.
-- OutwardArtifact gains the 72h read-back fields (insightsReadAt/reach/engagement);
-- ReasoningCacheEntry gains correctedAt so a corrected reuse un-counts.
--
-- The `DROP INDEX "VectorEmbedding_embedding_hnsw_idx"` block prisma emits at the
-- top has been EXCISED (CLAUDE.md gotcha) — the HNSW index is SQL-only and must
-- survive. (No Memory_metadata_gin_idx drop this run.)

-- AlterTable
ALTER TABLE "OutwardArtifact" ADD COLUMN     "engagementCount" INTEGER,
ADD COLUMN     "insightsReadAt" TIMESTAMP(3),
ADD COLUMN     "reach" INTEGER;

-- AlterTable
ALTER TABLE "ReasoningCacheEntry" ADD COLUMN     "correctedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "OutwardArtifact_insightsReadAt_idx" ON "OutwardArtifact"("insightsReadAt");
