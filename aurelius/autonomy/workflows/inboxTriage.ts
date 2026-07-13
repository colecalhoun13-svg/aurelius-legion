// aurelius/autonomy/workflows/inboxTriage.ts
//
// SECOND ACTING WORKFLOW — inbox triage → drafted replies (NORTH_STAR §2.5,
// action-class inbox.triage_draft). The Outsider council's exact dream: "wake
// up to drafted replies in my voice, I just hit send." Aurelius scans the
// inbox, decides what needs a reply, drafts one, and — through the executor —
// either puts it in Gmail drafts (if granted) or proposes it on the Bridge.
//
// The inward action is DRAFTING. Sending is a separate outward class (email.send)
// and Gmail has no send scope by construction — so "Aurelius emailed someone on
// its own" is impossible at two layers. What it produces is always a draft you
// review and send yourself.

import { prisma } from "../../core/db/prisma.ts";
import { gmailAuth, listInbox, readMessage, draftReply, type InboxItem } from "../../gmail/engine.ts";
import { runLLM } from "../../llm/runLLM.ts";
import { executeAction } from "../executor.ts";

const ACTION_CLASS = "inbox.triage_draft";

// Senders whose mail never wants a personal reply — filter cheaply before
// spending a model on a draft.
const NO_REPLY_RE = /no-?reply|noreply|notifications?@|mailer-daemon|newsletter|do-?not-?reply|@.*\.(mailchimp|substack|beehiiv)/i;

/** A message worth drafting a reply to: a real person, not a robot broadcast. */
export function needsReply(item: InboxItem): boolean {
  if (NO_REPLY_RE.test(item.from)) return false;
  if (!/@/.test(item.from)) return false;
  return true;
}

export type InboxTriageResult = {
  connected: boolean;
  scanned: number;
  needsReply: number;
  drafted: number; // Gmail drafts created (granted)
  proposed: number; // draft proposed on the Bridge (ungranted)
  skipped: number; // already handled (dedup)
  failed: number;
  signals: string[];
};

/** The commit step — registered so it runs on grant AND on Cole's confirm. */
export async function finalizeInboxDraft(payload: {
  to: string;
  subject: string;
  body: string;
  threadId?: string;
  messageId?: string;
}): Promise<any> {
  return draftReply({
    to: payload.to,
    subject: payload.subject,
    body: payload.body,
    threadId: payload.threadId,
    inReplyToMessageId: payload.messageId,
  });
}

export async function runInboxTriage(opts: { max?: number } = {}): Promise<InboxTriageResult> {
  const result: InboxTriageResult = {
    connected: false,
    scanned: 0,
    needsReply: 0,
    drafted: 0,
    proposed: 0,
    skipped: 0,
    failed: 0,
    signals: [],
  };

  if (!(await gmailAuth.isConnected())) {
    console.log("[inboxTriage] gmail not connected — dormant");
    return result; // connected:false, honest
  }
  result.connected = true;

  const inbox = await listInbox({ max: opts.max ?? 10 });
  result.scanned = inbox.length;

  for (const item of inbox) {
    if (!needsReply(item)) continue;

    const dedupKey = `triage:${item.id}`;
    const already = await prisma.bridgeSignal.count({
      where: { sourceType: "inbox_triage", sourceId: dedupKey },
    });
    if (already > 0) {
      result.skipped++;
      continue;
    }

    result.needsReply++;
    try {
      const exec = await executeAction({
        actionClass: ACTION_CLASS,
        sourceType: "inbox_triage",
        sourceId: dedupKey,
        prepare: async () => {
          const full = await readMessage(item.id);
          const draft = await runLLM({
            taskType: "quick_reply",
            operator: "strategy",
            input:
              `Draft a concise, warm, on-voice reply to this email as Cole. Return ONLY the reply body — no subject, no "Dear", no sign-off placeholder like [Name].\n\n` +
              `From: ${full.from}\nSubject: ${full.subject}\n\n${full.body.slice(0, 4000)}`,
          });
          const replyBody = (draft.text ?? "").trim();
          return {
            title: `Reply drafted — ${item.subject}`,
            body: `**From:** ${item.from}\n**Their note:** ${item.snippet}\n\n**Draft reply:**\n\n${replyBody}`,
            domain: "personal",
            payload: {
              to: item.from,
              subject: item.subject.startsWith("Re:") ? item.subject : `Re: ${item.subject}`,
              body: replyBody,
              threadId: item.threadId,
              messageId: item.id,
            },
          };
        },
      });
      result.signals.push(exec.bridgeSignalId);
      if (exec.finalized) result.drafted++;
      else result.proposed++;
    } catch (err: any) {
      result.failed++;
      console.warn(`[inboxTriage] ${item.id} failed:`, err?.message ?? err);
    }
  }

  console.log(
    `[inboxTriage] scanned ${result.scanned} · needsReply ${result.needsReply} · drafted ${result.drafted} · proposed ${result.proposed} · skipped ${result.skipped} · failed ${result.failed}`
  );
  return result;
}
