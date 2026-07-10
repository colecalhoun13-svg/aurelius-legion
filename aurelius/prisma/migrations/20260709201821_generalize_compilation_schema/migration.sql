-- Phase 4.5 Block 0 — generalize compilation schema for cross-operator use.
--
-- Rewritten as defensive drop+recreate: the original diff-based migration
-- assumed index state that had drifted on the production DB (indexes named
-- in migration history were never actually present). Both tables are empty
-- by construction — nothing wrote to them before this phase shipped — so
-- drop+recreate is lossless and converges any starting state.

-- DropTables (defensive — tolerate any drift)
DROP TABLE IF EXISTS "ReasoningCacheEntry" CASCADE;
DROP TABLE IF EXISTS "CompiledPattern" CASCADE;

-- CreateTable
CREATE TABLE "ReasoningCacheEntry" (
    "id" TEXT NOT NULL,
    "operatorId" TEXT NOT NULL,
    "domain" TEXT NOT NULL DEFAULT 'training_session',
    "entityKey" TEXT NOT NULL,
    "externalScopeId" TEXT NOT NULL,
    "subContext" TEXT,
    "situationSignature" JSONB NOT NULL,
    "reasoningSummary" TEXT NOT NULL,
    "sourceMemoryIds" TEXT[],
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "previousTags" JSONB[] DEFAULT ARRAY[]::JSONB[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReasoningCacheEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompiledPattern" (
    "id" TEXT NOT NULL,
    "operatorId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "entityKey" TEXT,
    "externalScopeId" TEXT,
    "patternType" TEXT NOT NULL,
    "patternSignature" JSONB NOT NULL,
    "conditions" JSONB,
    "status" TEXT NOT NULL DEFAULT 'proposed_heuristic',
    "evidence" TEXT[],
    "supportCount" INTEGER NOT NULL DEFAULT 0,
    "confidenceScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompiledPattern_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReasoningCacheEntry_operatorId_domain_entityKey_idx" ON "ReasoningCacheEntry"("operatorId", "domain", "entityKey");

-- CreateIndex
CREATE INDEX "ReasoningCacheEntry_operatorId_entityKey_externalScopeId_idx" ON "ReasoningCacheEntry"("operatorId", "entityKey", "externalScopeId");

-- CreateIndex
CREATE INDEX "ReasoningCacheEntry_domain_idx" ON "ReasoningCacheEntry"("domain");

-- CreateIndex
CREATE INDEX "CompiledPattern_operatorId_domain_entityKey_idx" ON "CompiledPattern"("operatorId", "domain", "entityKey");

-- CreateIndex
CREATE INDEX "CompiledPattern_operatorId_status_idx" ON "CompiledPattern"("operatorId", "status");

-- CreateIndex
CREATE INDEX "CompiledPattern_domain_idx" ON "CompiledPattern"("domain");

-- AddForeignKey
ALTER TABLE "ReasoningCacheEntry" ADD CONSTRAINT "ReasoningCacheEntry_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "Operator"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompiledPattern" ADD CONSTRAINT "CompiledPattern_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "Operator"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
