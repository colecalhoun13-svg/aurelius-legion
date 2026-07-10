-- CreateTable
CREATE TABLE "CorpusDocument" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL DEFAULT 'note',
    "sourceUrl" TEXT,
    "domain" TEXT NOT NULL DEFAULT 'personal',
    "operatorId" TEXT,
    "summary" TEXT NOT NULL,
    "contentText" TEXT NOT NULL,
    "chunkCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CorpusDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Correction" (
    "id" TEXT NOT NULL,
    "operatorId" TEXT,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "correctionType" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Correction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeasurementSnapshot" (
    "id" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "operatorId" TEXT,
    "metrics" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MeasurementSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IngestionRun" (
    "id" TEXT NOT NULL,
    "runType" TEXT NOT NULL,
    "operatorName" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'running',
    "sourcesQueried" JSONB,
    "findingsCount" INTEGER NOT NULL DEFAULT 0,
    "proposalsCreated" INTEGER NOT NULL DEFAULT 0,
    "errors" JSONB,
    "triggeredBy" TEXT NOT NULL DEFAULT 'schedule',

    CONSTRAINT "IngestionRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CorpusDocument_domain_createdAt_idx" ON "CorpusDocument"("domain", "createdAt");

-- CreateIndex
CREATE INDEX "CorpusDocument_createdAt_idx" ON "CorpusDocument"("createdAt");

-- CreateIndex
CREATE INDEX "Correction_targetType_targetId_idx" ON "Correction"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "Correction_createdAt_idx" ON "Correction"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "MeasurementSnapshot_weekStart_operatorId_key" ON "MeasurementSnapshot"("weekStart", "operatorId");

-- CreateIndex
CREATE INDEX "IngestionRun_startedAt_idx" ON "IngestionRun"("startedAt");

-- AddForeignKey
ALTER TABLE "CorpusDocument" ADD CONSTRAINT "CorpusDocument_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "Operator"("id") ON DELETE SET NULL ON UPDATE CASCADE;

