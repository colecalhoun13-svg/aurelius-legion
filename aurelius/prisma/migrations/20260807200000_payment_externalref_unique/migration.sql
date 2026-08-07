-- Council R2 (money integrity): the DB-level idempotency guard for self-recording
-- payments. App-level find-then-insert is a TOCTOU race — Stripe delivers a
-- payment's three events concurrently, and two handlers can both pass the
-- "already recorded?" check before either commits, double-counting the dollar.
-- Postgres treats NULLs as distinct, so cash/manual payments with no externalRef
-- are unaffected; only two rows sharing the SAME externalRef collide, which is
-- exactly the duplicate we reject. recordSelfPayment catches the P2002.
--
-- NOTE: the `prisma migrate diff` that generated this ALSO emitted a spurious
-- `DROP INDEX "VectorEmbedding_embedding_hnsw_idx"` (the HNSW index is SQL-only
-- and invisible to Prisma's datamodel) — excised per CLAUDE.md's migration gotcha
-- so we don't drop the live vector index on deploy.

-- CreateIndex
CREATE UNIQUE INDEX "Payment_externalRef_key" ON "Payment"("externalRef");
