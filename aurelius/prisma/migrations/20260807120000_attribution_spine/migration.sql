-- The attribution spine: TrackLink (minted, click-counted links), AttributionEvent
-- (the touch ledger), OutwardArtifact (authorship stamp), Payment.recordedBy, and
-- Lead attribution/thread columns.
--
-- The `DROP INDEX "VectorEmbedding_embedding_hnsw_idx"` block that `prisma migrate
-- diff` emits at the top has been EXCISED (see CLAUDE.md gotchas). The HNSW index
-- is SQL-only and must survive. (No Memory_metadata_gin_idx drop appeared this run.)

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "outreachThreadId" TEXT,
ADD COLUMN     "refCode" TEXT,
ADD COLUMN     "trackLinkId" TEXT;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "recordedBy" TEXT NOT NULL DEFAULT 'cole';

-- CreateTable
CREATE TABLE "TrackLink" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "destination" TEXT NOT NULL DEFAULT '/start',
    "channel" TEXT NOT NULL DEFAULT 'other',
    "label" TEXT,
    "angleId" TEXT,
    "offerId" TEXT,
    "artifactId" TEXT,
    "clickCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrackLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttributionEvent" (
    "kind" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'other',
    "refCode" TEXT,
    "trackLinkId" TEXT,
    "angleId" TEXT,
    "leadId" TEXT,
    "clientId" TEXT,
    "paymentId" TEXT,
    "amountCents" INTEGER,
    "metadata" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttributionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutwardArtifact" (
    "id" TEXT NOT NULL,
    "draftId" TEXT,
    "channel" TEXT NOT NULL DEFAULT 'instagram',
    "externalId" TEXT,
    "permalink" TEXT,
    "angleIds" TEXT[],
    "trackLinkId" TEXT,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutwardArtifact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TrackLink_code_key" ON "TrackLink"("code");

-- CreateIndex
CREATE INDEX "TrackLink_channel_idx" ON "TrackLink"("channel");

-- CreateIndex
CREATE INDEX "AttributionEvent_kind_occurredAt_idx" ON "AttributionEvent"("kind", "occurredAt");

-- CreateIndex
CREATE INDEX "AttributionEvent_channel_idx" ON "AttributionEvent"("channel");

-- CreateIndex
CREATE INDEX "AttributionEvent_leadId_idx" ON "AttributionEvent"("leadId");

-- CreateIndex
CREATE INDEX "AttributionEvent_refCode_idx" ON "AttributionEvent"("refCode");

-- CreateIndex
CREATE INDEX "OutwardArtifact_channel_publishedAt_idx" ON "OutwardArtifact"("channel", "publishedAt");

-- CreateIndex
CREATE INDEX "OutwardArtifact_externalId_idx" ON "OutwardArtifact"("externalId");

-- CreateIndex
CREATE INDEX "Lead_outreachThreadId_idx" ON "Lead"("outreachThreadId");

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_trackLinkId_fkey" FOREIGN KEY ("trackLinkId") REFERENCES "TrackLink"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackLink" ADD CONSTRAINT "TrackLink_angleId_fkey" FOREIGN KEY ("angleId") REFERENCES "MarketingAngle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackLink" ADD CONSTRAINT "TrackLink_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttributionEvent" ADD CONSTRAINT "AttributionEvent_trackLinkId_fkey" FOREIGN KEY ("trackLinkId") REFERENCES "TrackLink"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttributionEvent" ADD CONSTRAINT "AttributionEvent_angleId_fkey" FOREIGN KEY ("angleId") REFERENCES "MarketingAngle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttributionEvent" ADD CONSTRAINT "AttributionEvent_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
