-- Receipts are not decisions.
--
-- BridgeSignal.status defaults to "pending" and most writers never set it, so
-- ritual digests, wiki-rewrite notices and mission reports all filed themselves
-- as items awaiting Cole's tap. The 2026-08-06 council measured 460 "pending"
-- signals against one real decision — a bell that means "something happened"
-- gets muted, and the real decisions are lost with it.
--
-- surfaceSignal() now derives the status. This backfills the rows already in
-- flight: a background_result with no actionable button was never a decision.
-- Critical ones are deliberately left alone ("the nightly backup failed" IS
-- Cole's to act on), as is anything carrying a real action.
UPDATE "BridgeSignal"
SET "status" = 'noted'
WHERE "status" IN ('pending', 'surfaced')
  AND "kind" = 'background_result'
  AND "severity" <> 'critical'
  AND (
    "actions" IS NULL
    OR jsonb_typeof("actions") <> 'array'
    OR NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements("actions") AS a
      WHERE a->>'action' IS NOT NULL
        AND a->>'action' NOT IN ('dismiss', 'acknowledge')
    )
  );
