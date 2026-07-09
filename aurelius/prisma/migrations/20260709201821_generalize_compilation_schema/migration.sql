/*
  Warnings:

  - You are about to drop the column `sheetId` on the `CompiledPattern` table. All the data in the column will be lost.
  - You are about to drop the column `dayTab` on the `ReasoningCacheEntry` table. All the data in the column will be lost.
  - You are about to drop the column `sheetId` on the `ReasoningCacheEntry` table. All the data in the column will be lost.
  - Added the required column `domain` to the `CompiledPattern` table without a default value. This is not possible if the table is not empty.
  - Added the required column `externalScopeId` to the `ReasoningCacheEntry` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "CompiledPattern_operatorId_entityKey_idx";

-- DropIndex
DROP INDEX "ReasoningCacheEntry_operatorId_entityKey_idx";

-- DropIndex
DROP INDEX "ReasoningCacheEntry_operatorId_entityKey_sheetId_idx";

-- AlterTable
ALTER TABLE "CompiledPattern" DROP COLUMN "sheetId",
ADD COLUMN     "domain" TEXT NOT NULL,
ADD COLUMN     "externalScopeId" TEXT;

-- AlterTable
ALTER TABLE "ReasoningCacheEntry" DROP COLUMN "dayTab",
DROP COLUMN "sheetId",
ADD COLUMN     "domain" TEXT NOT NULL DEFAULT 'training_session',
ADD COLUMN     "externalScopeId" TEXT NOT NULL,
ADD COLUMN     "previousTags" JSONB[] DEFAULT ARRAY[]::JSONB[],
ADD COLUMN     "subContext" TEXT;

-- CreateIndex
CREATE INDEX "CompiledPattern_operatorId_domain_entityKey_idx" ON "CompiledPattern"("operatorId", "domain", "entityKey");

-- CreateIndex
CREATE INDEX "CompiledPattern_domain_idx" ON "CompiledPattern"("domain");

-- CreateIndex
CREATE INDEX "ReasoningCacheEntry_operatorId_domain_entityKey_idx" ON "ReasoningCacheEntry"("operatorId", "domain", "entityKey");

-- CreateIndex
CREATE INDEX "ReasoningCacheEntry_operatorId_entityKey_externalScopeId_idx" ON "ReasoningCacheEntry"("operatorId", "entityKey", "externalScopeId");

-- CreateIndex
CREATE INDEX "ReasoningCacheEntry_domain_idx" ON "ReasoningCacheEntry"("domain");
