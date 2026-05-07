-- CreateTable
CREATE TABLE "ReasoningCacheEntry" (
    "id" TEXT NOT NULL,
    "operatorId" TEXT NOT NULL,
    "entityKey" TEXT NOT NULL,
    "sheetId" TEXT NOT NULL,
    "dayTab" TEXT,
    "situationSignature" JSONB NOT NULL,
    "reasoningSummary" TEXT NOT NULL,
    "sourceMemoryIds" TEXT[],
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReasoningCacheEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompiledPattern" (
    "id" TEXT NOT NULL,
    "operatorId" TEXT NOT NULL,
    "entityKey" TEXT,
    "sheetId" TEXT,
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
CREATE INDEX "ReasoningCacheEntry_operatorId_entityKey_sheetId_idx" ON "ReasoningCacheEntry"("operatorId", "entityKey", "sheetId");

-- CreateIndex
CREATE INDEX "ReasoningCacheEntry_operatorId_entityKey_idx" ON "ReasoningCacheEntry"("operatorId", "entityKey");

-- CreateIndex
CREATE INDEX "CompiledPattern_operatorId_entityKey_idx" ON "CompiledPattern"("operatorId", "entityKey");

-- CreateIndex
CREATE INDEX "CompiledPattern_operatorId_status_idx" ON "CompiledPattern"("operatorId", "status");

-- AddForeignKey
ALTER TABLE "ReasoningCacheEntry" ADD CONSTRAINT "ReasoningCacheEntry_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "Operator"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompiledPattern" ADD CONSTRAINT "CompiledPattern_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "Operator"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
