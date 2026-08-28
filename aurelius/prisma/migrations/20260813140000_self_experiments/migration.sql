-- n=1 self-experiments (Athlete Zero). The Prisma diff's SQL-only DROP INDEX
-- block is excised per the repo's standing migration gotcha.

-- CreateTable
CREATE TABLE "SelfExperiment" (
    "id" TEXT NOT NULL,
    "hypothesis" TEXT NOT NULL,
    "protocol" TEXT,
    "metricLabel" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endAt" TIMESTAMP(3),
    "baselineValue" DOUBLE PRECISION,
    "resultValue" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'running',
    "verdict" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SelfExperiment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SelfExperiment_status_idx" ON "SelfExperiment"("status");
