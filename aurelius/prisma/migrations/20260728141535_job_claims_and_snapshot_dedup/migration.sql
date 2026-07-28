-- Go-live council reliability migration.
-- (The DropIndex "VectorEmbedding_embedding_hnsw_idx" the diff always emits
-- has been excised per CLAUDE.md — the HNSW index stays.)

-- CreateTable: atomic once-per-day job claims
CREATE TABLE "JobRun" (
    "id" TEXT NOT NULL,
    "jobName" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'running',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "JobRun_jobName_day_key" ON "JobRun"("jobName", "day");

-- MeasurementSnapshot: Postgres treats NULLs as distinct, so the schema's
-- @@unique([weekStart, operatorId]) never constrained whole-system rows
-- (operatorId NULL) — concurrent Sunday runs created duplicate snapshots.
-- Dedup (keep newest), then add the partial unique the schema can't express.
DELETE FROM "MeasurementSnapshot" a
USING "MeasurementSnapshot" b
WHERE a."operatorId" IS NULL AND b."operatorId" IS NULL
  AND a."weekStart" = b."weekStart"
  AND a."createdAt" < b."createdAt";

CREATE UNIQUE INDEX "MeasurementSnapshot_weekStart_system_key"
  ON "MeasurementSnapshot"("weekStart")
  WHERE "operatorId" IS NULL;
