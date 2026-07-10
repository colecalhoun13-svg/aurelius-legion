
-- CreateTable
CREATE TABLE "Mission" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "objective" TEXT NOT NULL,
    "domain" TEXT NOT NULL DEFAULT 'personal',
    "operatorName" TEXT,
    "origin" TEXT NOT NULL DEFAULT 'cole',
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "status" TEXT NOT NULL DEFAULT 'proposed',
    "planSummary" TEXT,
    "report" TEXT,
    "corpusDocId" TEXT,
    "error" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Mission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MissionStep" (
    "id" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "idx" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "input" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "output" TEXT,
    "error" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MissionStep_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Mission_status_createdAt_idx" ON "Mission"("status", "createdAt");

-- CreateIndex
CREATE INDEX "MissionStep_missionId_idx_idx" ON "MissionStep"("missionId", "idx");

-- AddForeignKey
ALTER TABLE "MissionStep" ADD CONSTRAINT "MissionStep_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "Mission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

