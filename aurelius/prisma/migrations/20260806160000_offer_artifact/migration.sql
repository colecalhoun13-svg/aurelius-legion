-- Offer: the durable artifact marketing, outreach and engagements all point at.
-- NOTE: the `DROP INDEX "VectorEmbedding_embedding_hnsw_idx"` block that
-- `prisma migrate diff` always emits has been excised (see CLAUDE.md gotchas).
-- The HNSW index is SQL-only and must survive.

-- AlterTable
ALTER TABLE "Engagement" ADD COLUMN     "offerId" TEXT;

-- CreateTable
CREATE TABLE "Offer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "audience" TEXT NOT NULL,
    "promise" TEXT NOT NULL,
    "shape" TEXT NOT NULL,
    "format" TEXT,
    "proof" TEXT,
    "edge" TEXT,
    "assumptions" TEXT,
    "priceCents" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "durationWeeks" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "grounding" TEXT NOT NULL DEFAULT 'none',
    "sources" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "activatedAt" TIMESTAMP(3),
    "retiredAt" TIMESTAMP(3),

    CONSTRAINT "Offer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Offer_status_idx" ON "Offer"("status");

-- AddForeignKey
ALTER TABLE "Engagement" ADD CONSTRAINT "Engagement_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
