
-- CreateTable
CREATE TABLE "KnowledgeProposal" (
    "id" TEXT NOT NULL,
    "operatorId" TEXT NOT NULL,
    "operatorName" TEXT NOT NULL,
    "intentClassId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "proposedValue" JSONB NOT NULL,
    "priorValue" JSONB,
    "rationale" TEXT NOT NULL DEFAULT '',
    "coleNaturalLanguage" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "cacheEntryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "KnowledgeProposal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "KnowledgeProposal_operatorId_status_idx" ON "KnowledgeProposal"("operatorId", "status");

-- CreateIndex
CREATE INDEX "KnowledgeProposal_status_createdAt_idx" ON "KnowledgeProposal"("status", "createdAt");

