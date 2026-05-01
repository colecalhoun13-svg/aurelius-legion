/*
  Warnings:

  - You are about to drop the column `createdAt` on the `Operator` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Operator" DROP COLUMN "createdAt",
ADD COLUMN     "cooldownSeconds" INTEGER DEFAULT 60,
ADD COLUMN     "domain" TEXT,
ADD COLUMN     "lastRunAt" TIMESTAMP(3),
ADD COLUMN     "priority" INTEGER DEFAULT 1;
