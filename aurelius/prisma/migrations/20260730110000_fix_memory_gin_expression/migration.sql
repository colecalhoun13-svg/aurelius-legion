-- Fix the Memory metadata GIN (post-sweep council, EXPLAIN-verified).
-- Prisma's { path: ["relatedOperators"], array_contains: ... } compiles to
-- (metadata #> '{relatedOperators}') @> $1 — an extraction EXPRESSION, which
-- a whole-column jsonb_path_ops GIN cannot serve. Replace it with the
-- expression index matching that exact shape (#>, not ->: the planner
-- matches index expressions operator-for-operator). Same name, still
-- SQL-only: future prisma migrate diffs will emit a DROP for it — excise,
-- per the hnsw gotcha in CLAUDE.md.

DROP INDEX IF EXISTS "Memory_metadata_gin_idx";

CREATE INDEX "Memory_metadata_gin_idx" ON "Memory" USING GIN ((metadata #> '{relatedOperators}') jsonb_path_ops);
