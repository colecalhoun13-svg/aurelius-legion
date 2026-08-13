-- Personal finance (Cole's own money — separate from the business ledger,
-- never indexed into the vector store). The Prisma diff emits a DROP INDEX for
-- the SQL-only HNSW/GIN indexes on every migration; those blocks are excised
-- here per the repo's standing migration gotcha.

-- CreateTable
CREATE TABLE "FinanceAccount" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'checking',
    "balanceCents" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "lastBalanceAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceTxn" (
    "id" TEXT NOT NULL,
    "accountId" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'other',
    "description" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "importHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinanceTxn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NetWorthSnapshot" (
    "id" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assetsCents" INTEGER NOT NULL,
    "liabilitiesCents" INTEGER NOT NULL,
    "netCents" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NetWorthSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FinanceAccount_kind_idx" ON "FinanceAccount"("kind");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceTxn_importHash_key" ON "FinanceTxn"("importHash");

-- CreateIndex
CREATE INDEX "FinanceTxn_date_idx" ON "FinanceTxn"("date");

-- CreateIndex
CREATE INDEX "FinanceTxn_category_idx" ON "FinanceTxn"("category");

-- CreateIndex
CREATE INDEX "NetWorthSnapshot_at_idx" ON "NetWorthSnapshot"("at");

-- AddForeignKey
ALTER TABLE "FinanceTxn" ADD CONSTRAINT "FinanceTxn_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "FinanceAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
