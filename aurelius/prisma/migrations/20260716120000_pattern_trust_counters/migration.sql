-- Trust counters (council red-team amendment): monotone, machine-readable,
-- non-saturating. These — not the drifting confidence float — will gate the
-- short-circuit. Hand-written migration (no prisma migrate diff: it emits a
-- spurious DROP INDEX for the hnsw vector index).
ALTER TABLE "CompiledPattern" ADD COLUMN "validatedCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "CompiledPattern" ADD COLUMN "ratifiedCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "CompiledPattern" ADD COLUMN "correctionsSinceConfirm" INTEGER NOT NULL DEFAULT 0;
