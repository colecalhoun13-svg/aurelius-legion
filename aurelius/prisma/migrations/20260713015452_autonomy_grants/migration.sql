-- CreateTable
CREATE TABLE "AutonomyGrant" (
    "id" TEXT NOT NULL,
    "operator" TEXT NOT NULL,
    "actionClass" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "grantedBy" TEXT NOT NULL DEFAULT 'cole',
    "note" TEXT,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "AutonomyGrant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AutonomyGrant_status_idx" ON "AutonomyGrant"("status");

-- CreateIndex
CREATE UNIQUE INDEX "AutonomyGrant_operator_actionClass_key" ON "AutonomyGrant"("operator", "actionClass");
