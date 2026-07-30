-- Hot-table indexes (final council, efficiency seat findings 5 + 8).
-- Memory: prompt assembly runs up to 11 sequential scans of this table per
-- LLM call; LogEntry: the fastest-growing, hottest-read table (boot catch-up
-- scans it per job at every boot, the traces cockpit and scoreboard aggregate
-- it). Hand-written (not prisma migrate diff) to dodge the known hnsw
-- DropIndex artifact — index names match Prisma's defaults so future diffs
-- stay quiet.

-- CreateIndex
CREATE INDEX "Memory_operatorId_category_createdAt_idx" ON "Memory"("operatorId", "category", "createdAt");

-- CreateIndex
CREATE INDEX "LogEntry_type_message_createdAt_idx" ON "LogEntry"("type", "message", "createdAt");

-- CreateIndex
CREATE INDEX "LogEntry_createdAt_idx" ON "LogEntry"("createdAt");

-- GIN for Memory.metadata array_contains filters (prompt keyword scans).
-- SQL-only, like the hnsw vector index and the MeasurementSnapshot partial
-- unique — Prisma's schema language can't express it, so future migrate
-- diffs will try to DROP it; excise that block, same as the hnsw gotcha.
CREATE INDEX "Memory_metadata_gin_idx" ON "Memory" USING GIN ("metadata" jsonb_path_ops);
