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
  /** Optional override; when omitted the confirm uses the draft's own subject. */
  subject?: string;
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

  // Read the ACTUAL draft so the confirm card shows Cole the exact words that
  // will go out. The reactive path auto-composes the draft (possibly from an
  // inbound message he hasn't opened), so the send confirm must BE the review —
  // it can't claim "the draft you reviewed" and then show nothing. If the draft
  // can't be read (dormant Gmail, deleted draft), refuse rather than stage a
  // blind send.
  let live: { to: string; subject: string; body: string } | null = null;
  try {
    const { readDraft } = await import("./engine.ts");
    live = await readDraft(draftId);
  } catch {
    live = null;
  }
  if (!live || !live.body) {
    return { ok: false, error: "Couldn't read that draft to show you before sending — is Gmail connected and the draft still there? Nothing staged." };
  }
  const shownBody = live.body.length > 1200 ? `${live.body.slice(0, 1200)}…` : live.body;
  const subject = input.subject || live.subject;

  const prepare = async () => ({
    title: `Send to ${to}?`,
    body:
      `${subject ? `**${subject}**\n\n` : ""}` +
      `${shownBody}\n\n` +
      `— This is the full message. Confirm to send it as-is; nothing goes out until you tap, and a send can't be recalled.`,
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
