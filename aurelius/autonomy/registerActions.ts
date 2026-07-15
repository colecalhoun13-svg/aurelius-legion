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
import { confirmHeuristic } from "../compiled/chatCompiler.ts";
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
  // Applying a grant is Cole's hand on the switch (hard rule 1). When the web
  // chat asks to grant a keyhole, the autonomy tool files a GATED proposal;
  // this finalizer runs only when Cole taps Confirm on the Bridge.
  registerActionFinalizer("autonomy.apply_grant", async (payload: any) =>
    grantAutonomy({ actionClass: payload?.actionClass, grantedBy: "cole", note: "granted via Bridge confirm" })
  );
}
