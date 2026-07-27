// aurelius/autonomy/registerActions.ts
//
// One place that wires every action-class to its commit function. Called once
// at boot (and in the smoke suite) so both the act-now path and the
// confirm-later path can find a finalizer. Adding a new acting workflow = write
// its finalizer + register it here.

import { registerActionFinalizer, registerActionInverse } from "./actionRegistry.ts";
import { finalizeScheduleProtection } from "./workflows/scheduleProtection.ts";
import { finalizeInboxDraft } from "./workflows/inboxTriage.ts";
import { finalizeContentPublish } from "./workflows/contentPublish.ts";
import { finalizeResearchIngest } from "./workflows/researchIngest.ts";
import { confirmHeuristic, retireHeuristic } from "../compiled/chatCompiler.ts";
import { grantAutonomy } from "./grants.ts";

let registered = false;

export function registerAllActions(): void {
  if (registered) return;
  registered = true;
  registerActionFinalizer("calendar.schedule_protection", finalizeScheduleProtection);
  // Real undo: reversing a placed focus-block hold = deleting the event it created.
  registerActionInverse("calendar.schedule_protection", async (_payload, result) => {
    const { deleteCalendarEvent } = await import("../calendar/engine.ts");
    return deleteCalendarEvent(result?.externalId);
  });
  registerActionFinalizer("inbox.triage_draft", finalizeInboxDraft);
  // Outward: publishing content. executeAction always GATES this (outward class),
  // so the finalizer only runs on Cole's Bridge confirm.
  registerActionFinalizer("content.publish", finalizeContentPublish);
  // Inward: run a proposed research mission end-to-end + ingest its report.
  // Granted → the initiative pulse runs its own proposals; else Cole confirms.
  registerActionFinalizer("research.ingest", finalizeResearchIngest);
  // Confirm a chat-mined heuristic → it starts grounding future reasoning. Always
  // gated (unknown class), so it only fires on Cole's Bridge tap.
  registerActionFinalizer("pattern.confirm", async (payload: any) => confirmHeuristic(payload?.patternId));
  // Retire a rule Cole once confirmed (proposed when it decays to the trust
  // floor — confirmed rules never die silently). Gated: only his tap fires it.
  registerActionFinalizer("pattern.retire", async (payload: any) => retireHeuristic(payload?.patternId));
  // Applying a grant is Cole's hand on the switch (hard rule 1). When the web
  // chat asks to grant a keyhole, the autonomy tool files a GATED proposal;
  // this finalizer runs only when Cole taps Confirm on the Bridge.
  registerActionFinalizer("autonomy.apply_grant", async (payload: any) =>
    grantAutonomy({ actionClass: payload?.actionClass, grantedBy: "cole", note: "granted via Bridge confirm" })
  );
  // Inward: file a research/ingestion-born knowledge proposal into Living
  // Knowledge. Runs under the knowledge.apply_proposal keyhole (or Cole's
  // Bridge confirm when ungranted). Dynamic import breaks the proposals ↔
  // executor cycle. Provenance stays honest: research_ingestion by aurelius.
  registerActionFinalizer("knowledge.apply_proposal", async (payload: any) => {
    const { resolveProposal } = await import("../knowledge/proposals.ts");
    return resolveProposal({
      operatorId: payload?.operatorId,
      proposalId: payload?.proposalId,
      decision: "confirmed",
      coleResponseText: "auto-filed under the knowledge.apply_proposal grant",
      sourceType: "research_ingestion",
      updatedBy: "aurelius",
    });
  });
  // Real undo: restore the prior value (or deactivate the entry the apply
  // created) and mark the proposal denied so it can't silently re-apply.
  registerActionInverse("knowledge.apply_proposal", async (payload: any) => {
    const { undoAppliedProposal } = await import("../knowledge/proposals.ts");
    return undoAppliedProposal(payload?.operatorId, payload?.proposalId);
  });
}
