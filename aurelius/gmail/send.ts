// aurelius/gmail/send.ts
//
// THE GATED SEND — the one place a drafted message is STAGED to actually go
// out. It never sends: it calls executeAction on an OUTWARD class, which the
// executor gates by construction, so this returns a pending Bridge confirm and
// nothing leaves until Cole taps. That is the flagship "one tap": Aurelius
// drafts the reply (inward), stages the send (this), and Cole's single confirm
// delivers the exact draft he reviewed.
//
// Two classes, both outward and non-grantable: outreach.send (a lead/business
// message) and email.send (an inbox reply). They share one finalizer
// (sendDraft) but stay distinct so the trust ledger and the confirm copy can
// tell "sent outreach" from "sent an email".
//
// A send is IRREVERSIBLE — once it's in someone's inbox it can't be recalled —
// so there is deliberately no inverse/Undo. The gate before it is the safety,
// not an undo after it.

import { executeAction } from "../autonomy/executor.ts";

export type StageSendInput = {
  draftId: string;
  to: string;
  subject?: string;
  /** A short preview of the body so the Bridge card shows what will go out. */
  preview?: string;
  kind: "outreach" | "email";
  /** For outreach: the lead this send belongs to, stamped on delivery. */
  leadId?: string;
  operatorId?: string | null;
};

export async function stageGmailSend(input: StageSendInput): Promise<{
  ok: boolean;
  bridgeSignalId?: string;
  finalized?: boolean;
  error?: string;
}> {
  const draftId = (input.draftId ?? "").trim();
  const to = (input.to ?? "").trim();
  if (!draftId) return { ok: false, error: "Nothing to send — no draft id." };
  if (!to) return { ok: false, error: "No recipient on the draft." };

  const prepare = async () => ({
    title: `Send to ${to}?`,
    body:
      `${input.subject ? `**${input.subject}**\n\n` : ""}` +
      `${input.preview ? `${input.preview.slice(0, 400)}${input.preview.length > 400 ? "…" : ""}\n\n` : ""}` +
      `Confirm to send the draft you reviewed — its exact words. Nothing goes out until you tap, and a send can't be recalled.`,
    domain: input.kind === "outreach" ? "business" : "inbox",
    payload: { draftId, to, kind: input.kind, leadId: input.leadId ?? null },
  });

  // Literal actionClass per branch: the reachability audit proves an outward
  // stager exists by finding executeAction({actionClass:"<literal>"}), and a
  // variable would read as "no stager". Both branches gate identically.
  const exec =
    input.kind === "outreach"
      ? await executeAction({ actionClass: "outreach.send", sourceType: "gmail_send_request", sourceId: `send:${draftId}`, operatorId: input.operatorId ?? null, prepare })
      : await executeAction({ actionClass: "email.send", sourceType: "gmail_send_request", sourceId: `send:${draftId}`, operatorId: input.operatorId ?? null, prepare });

  // Outward → executeAction always gates: a pending Bridge confirm, never a send.
  return { ok: true, bridgeSignalId: exec.bridgeSignalId, finalized: exec.finalized };
}
