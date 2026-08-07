-- ContentDraft: the queue between "written" and "published".
-- NOTE: the `DROP INDEX "VectorEmbedding_embedding_hnsw_idx"` block that
-- `prisma migrate diff` always emits has been excised (CLAUDE.md gotchas).

-- CreateTable
CREATE TABLE "ContentDraft" (
    "id" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'instagram',
    "format" TEXT,
    "title" TEXT,
    "body" TEXT NOT NULL,
    "angleId" TEXT,
    "grounding" TEXT NOT NULL DEFAULT 'none',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "imageUrl" TEXT,
    "scheduledFor" TIMESTAMP(3),
    "bridgeSignalId" TEXT,
    "publishedAt" TIMESTAMP(3),
    "permalink" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentDraft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContentDraft_status_createdAt_idx" ON "ContentDraft"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "ContentDraft" ADD CONSTRAINT "ContentDraft_angleId_fkey" FOREIGN KEY ("angleId") REFERENCES "MarketingAngle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
