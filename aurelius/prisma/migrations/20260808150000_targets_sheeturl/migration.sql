-- Targets ("squat 315 by November") + per-athlete program sheet URL.
-- NOTE: spurious `DROP INDEX "VectorEmbedding_embedding_hnsw_idx"` excised per CLAUDE.md.

-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "sheetUrl" TEXT;

-- CreateTable
CREATE TABLE "AthleteTarget" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "unit" TEXT,
    "targetValue" DOUBLE PRECISION NOT NULL,
    "targetDate" TIMESTAMP(3),
    "note" TEXT,
    "achievedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AthleteTarget_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AthleteTarget_clientId_achievedAt_idx" ON "AthleteTarget"("clientId", "achievedAt");

-- AddForeignKey
ALTER TABLE "AthleteTarget" ADD CONSTRAINT "AthleteTarget_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
