-- Retention/referral (Wave 4, dormant until client #1): Metric (PR ledger),
-- Referral, and Client check-in cadence fields.
--
-- The `DROP INDEX "VectorEmbedding_embedding_hnsw_idx"` block prisma emits at the
-- top is EXCISED (CLAUDE.md gotcha) — the HNSW index is SQL-only and must survive.

-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "checkInEveryDays" INTEGER,
ADD COLUMN     "lastCheckInAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Metric" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "sessionId" TEXT,
    "label" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "unit" TEXT,
    "isPR" BOOLEAN NOT NULL DEFAULT false,
    "achievedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL DEFAULT 'coach',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Metric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Referral" (
    "id" TEXT NOT NULL,
    "referrerClientId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'proposed',
    "referredLeadId" TEXT,
    "askDraftedAt" TIMESTAMP(3),
    "askedAt" TIMESTAMP(3),
    "capturedAt" TIMESTAMP(3),
    "thankedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Referral_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Metric_clientId_label_achievedAt_idx" ON "Metric"("clientId", "label", "achievedAt");
CREATE INDEX "Metric_isPR_achievedAt_idx" ON "Metric"("isPR", "achievedAt");
CREATE INDEX "Referral_referrerClientId_status_idx" ON "Referral"("referrerClientId", "status");
CREATE INDEX "Referral_status_idx" ON "Referral"("status");

-- AddForeignKey
ALTER TABLE "Metric" ADD CONSTRAINT "Metric_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_referrerClientId_fkey" FOREIGN KEY ("referrerClientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
