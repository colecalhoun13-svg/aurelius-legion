-- Completeness wave: Expense (the honest negative) + Promise (the ledger of
-- promises). NOTE: prisma migrate diff emitted its usual spurious DROP INDEX
-- for the SQL-only HNSW/GIN indexes — excised per the CLAUDE.md migration gotcha.

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "category" TEXT NOT NULL DEFAULT 'other',
    "note" TEXT,
    "incurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL DEFAULT 'cole',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Promise" (
    "id" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "counterpart" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'open',
    "sourceType" TEXT NOT NULL DEFAULT 'chat',
    "sourceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "Promise_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Expense_incurredAt_idx" ON "Expense"("incurredAt");

-- CreateIndex
CREATE INDEX "Promise_status_dueAt_idx" ON "Promise"("status", "dueAt");

