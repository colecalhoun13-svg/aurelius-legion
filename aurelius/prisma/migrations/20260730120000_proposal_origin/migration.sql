-- Queue justice (Cole's ruling on the 365-deep backlog): persist each
-- proposal's origin so the nightly sweep can prove keyhole eligibility for
-- rows the grant wasn't live to catch at creation. Nullable — backlog rows
-- predate the column and are classified by the research engine's
-- deterministic rationale prefix instead. Hand-written (hnsw/GIN diff
-- gotcha stays out of the migration).

-- AlterTable
ALTER TABLE "KnowledgeProposal" ADD COLUMN "origin" TEXT;
