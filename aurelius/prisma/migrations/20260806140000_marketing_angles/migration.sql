-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "angleId" TEXT;

-- CreateTable
CREATE TABLE "MarketingAngle" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "hypothesis" TEXT NOT NULL,
    "audience" TEXT NOT NULL,
    "grounding" TEXT NOT NULL DEFAULT 'none',
    "sources" JSONB,
    "rationale" TEXT,
    "status" TEXT NOT NULL DEFAULT 'proposed',
    "timesUsed" INTEGER NOT NULL DEFAULT 0,
    "replies" INTEGER NOT NULL DEFAULT 0,
    "conversions" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketingAngle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MarketingAngle_status_idx" ON "MarketingAngle"("status");

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_angleId_fkey" FOREIGN KEY ("angleId") REFERENCES "MarketingAngle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

