-- The Gmail draft id waiting for a lead, so a gated outreach.send can deliver
-- the exact reviewed draft on Cole's one tap.
ALTER TABLE "Lead" ADD COLUMN "outreachDraftId" TEXT;
