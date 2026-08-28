// aurelius/autonomy/registerActions.ts
//
// One place that wires every action-class to its commit function. Called once
// at boot (and in the smoke suite) so both the act-now path and the
// confirm-later path can find a finalizer. Adding a new acting workflow = write
// its finalizer + register it here.

import { registerActionFinalizer, registerActionInverse } from "./actionRegistry.ts";
import { finalizeScheduleProtection } from "./workflows/scheduleProtection.ts";
import { finalizeInboxDraft } from "./workflows/inboxTriage.ts";
import { finalizeOutreachDraft } from "../crm/leadEngine.ts";
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
  // Inward: writes a Gmail DRAFT and advances the lead's follow-up date.
  // Sending stays outward (outreach.send) and non-grantable.
  registerActionFinalizer("outreach.draft", finalizeOutreachDraft);
  // Inward: keep a drafted post in the content queue. `content.draft` was a
  // declared class with NO finalizer, which meant every draft gated as an
  // unactionable proposal and the copy died with the conversation.
  registerActionFinalizer("content.draft", async (payload: any) => {
    const { saveDraft } = await import("../content/queue.ts");
    return saveDraft({
      body: payload?.caption ?? "",
      channel: payload?.channel,
      title: payload?.title,
      angleId: payload?.angleId,
      format: payload?.format,
    });
  });
  // Real undo: a kept draft is discarded, not deleted — the idea stays visible
  // so nothing re-proposes it as if it were new.
  registerActionInverse("content.draft", async (_payload, result) => {
    const { discardDraft } = await import("../content/queue.ts");
    return result?.id ? discardDraft(result.id) : { ok: true };
  });
  // Outward: publishing content. executeAction always GATES this (outward class),
  // so the finalizer only runs on Cole's Bridge confirm.
  registerActionFinalizer("content.publish", finalizeContentPublish);
  // Outward: SEND a drafted email. Gated by construction (outward class), so
  // this only ever runs on Cole's Bridge confirm — the flagship "one tap".
  // email.send (an inbox reply) and outreach.send (a lead message) share this
  // finalizer but stay distinct classes so the trust ledger tells them apart.
  // No inverse: a sent email can't be recalled, so there is no Undo to offer —
  // the gate before it is the safety.
  const finalizeGmailSend = async (payload: any) => {
    const { sendDraft } = await import("../gmail/engine.ts");
    const sent = await sendDraft(payload?.draftId);
    // A real send is the true contact moment — stamp the lead so its follow-up
    // cadence counts from when it actually went out, not when it was drafted.
    // Clear outreachDraftId: the draft is now sent (Gmail consumed it), so the
    // lead must not read "draft waiting" and a later "send that" must not re-stage
    // a dead draftId (which would 404 on confirm).
    if (payload?.leadId) {
      const { prisma } = await import("../core/db/prisma.ts");
      await prisma.lead
        .update({ where: { id: payload.leadId }, data: { lastContactAt: new Date(), status: "contacted", outreachDraftId: null } })
        .catch(() => {});
    }
    return { messageId: sent.messageId, threadId: sent.threadId, to: payload?.to };
  };
  registerActionFinalizer("email.send", finalizeGmailSend);
  registerActionFinalizer("outreach.send", finalizeGmailSend);
  // Outward: send an SMS via Twilio. Gated by construction; runs on confirm only.
  registerActionFinalizer("sms.send", async (payload: any) => {
    const { sendSms } = await import("../crm/sms.ts");
    return sendSms({ to: payload?.to, body: payload?.body });
  });
  // Outward: spend on a paid boost. Gated by construction; runs on confirm only.
  registerActionFinalizer("ads.spend", async (payload: any) => {
    const { finalizeBoost } = await import("../business/paidBoost.ts");
    return finalizeBoost(payload);
  });
  // Never-grant inward: record a payment PARSED FROM AN EMAIL. The class carries
  // neverGrant (a From header is spoofable), so executeAction/decideAction would
  // always gate it anyway — but the email path surfaces the confirm directly, so
  // this finalizer only ever runs on Cole's Bridge tap. recordSelfPayment is
  // idempotent on externalRef, so a double-confirm can't double-count.
  registerActionFinalizer("payment.record", async (payload: any) => {
    const { recordSelfPayment } = await import("../crm/selfRecord.ts");
    return recordSelfPayment({
      amountCents: payload?.amountCents,
      email: payload?.email ?? null,
      phone: payload?.phone ?? null,
      payerName: payload?.payerName ?? null,
      method: payload?.method,
      externalRef: payload?.externalRef ?? null,
      recordedBy: payload?.recordedBy ?? "email_confirmed",
    });
  });
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
    const resolved = await resolveProposal({
      operatorId: payload?.operatorId,
      proposalId: payload?.proposalId,
      decision: "confirmed",
      coleResponseText: "auto-filed under the knowledge.apply_proposal grant",
      sourceType: "research_ingestion",
      updatedBy: "aurelius",
    });
    // Claim lost (post-sweep council): resolveProposal returns the fresh row
    // WITHOUT throwing when someone else — Cole denying it at 21:15, or a
    // concurrent keyhole — resolved it first. Filing an "acted" receipt with
    // a live Undo for a write that never happened would let that Undo clobber
    // state the sweep never touched. Throw so the executor files nothing.
    if (!resolved || !(resolved as any).claimWon) {
      throw new Error(
        `apply claim lost — proposal ${payload?.proposalId} is ${resolved?.status ?? "missing"}, nothing was written by this call`
      );
    }
    return resolved;
  });
  // Real undo: restore the prior value (or deactivate the entry the apply
  // created) and mark the proposal denied so it can't silently re-apply.
  registerActionInverse("knowledge.apply_proposal", async (payload: any) => {
    const { undoAppliedProposal } = await import("../knowledge/proposals.ts");
    return undoAppliedProposal(payload?.operatorId, payload?.proposalId);
  });
}
