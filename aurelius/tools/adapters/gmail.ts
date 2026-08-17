// aurelius/tools/adapters/gmail.ts
//
// GMAIL as a registered tool — Aurelius reads the inbox and drafts replies via
// [TOOL: ...] directives. Sending exists but is OUTWARD: `send` stages a gated
// proposal, so a message leaves ONLY on Cole's Bridge confirm — never on its
// own, never on a grant. Drafting lands in Cole's Gmail for review; sending is
// the one tap after. Honest-dormant until the one-time /api/gmail/auth.

import type { ToolAdapter, ToolAdapterResult } from "../types.ts";
import { gmailAuth, listInbox, readMessage, draftReply } from "../../gmail/engine.ts";

const NOT_CONNECTED = "Gmail not connected — open /api/gmail/auth once to authorize (read + draft only)";

export const gmailAdapter: ToolAdapter = {
  name: "gmail",
  // NON-IDEMPOTENT — never auto-retry. The engine's default retry re-runs the
  // call on failure, and its timeout does NOT cancel the in-flight promise: a
  // slow write that trips the ceiling would land AND be retried, duplicating
  // drafts. Fail once, honestly, and let Cole decide.
  maxRetries: 0,
  description:
    "Gmail: scan the inbox for what needs Cole, read a message, draft a reply for his review, and — only on his confirm — SEND a reviewed draft.",
  actions: [
    {
      name: "read_inbox",
      description: "Recent messages worth attention (unread + important, last 7 days by default).",
      dataSchema: '{ max?: number, query?: string (Gmail search, e.g. "is:starred") }',
    },
    {
      name: "send",
      description:
        "SEND a drafted email — OUTWARD, always Cole's confirm. Stages a gated 'Send?' proposal on the Bridge; nothing leaves until he taps, and a send can't be recalled. Give a lead name to send the outreach draft waiting for them, or a draftId+to for any draft. Use for 'send that to Jake', 'send the reply'.",
      dataSchema: '{ lead?: string, draftId?: string, to?: string }',
      example: '[TOOL: gmail.send {"lead": "Jake"}]',
    },
    {
      name: "read_message",
      description: "Full text of one message by id.",
      dataSchema: "{ id: string }",
    },
    {
      name: "draft_reply",
      description:
        "Create a DRAFT reply in Cole's Gmail (he reviews and sends — Aurelius cannot send).",
      dataSchema: '{ to: string, subject: string, body: string, threadId?: string, inReplyToMessageId?: string }',
      example: '[TOOL: gmail.draft_reply {"to": "coach@team.com", "subject": "Session times", "body": "Thanks — Tuesday 4pm works."}]',
    },
  ],

  async run(action, data): Promise<ToolAdapterResult> {
    if (!(await gmailAuth.isConnected())) {
      return { ok: false, output: null, error: NOT_CONNECTED };
    }
    switch (action) {
      case "read_inbox": {
        const items = await listInbox({ max: Number(data?.max) || 10, query: data?.query });
        // Defuse (council C3): email subject/snippet is attacker-controlled and
        // is fed back into the agentic tool loop — strip any [TOOL:]/[SAVE:]
        // directive syntax so a hostile message can't mimic a command. web.ts
        // and googleSheets already do this; gmail is the cheapest attacker
        // channel and was the one read adapter that didn't.
        const { defuseDirectives } = await import("../../llm/directiveParser.ts");
        return {
          ok: true,
          output: {
            summary: `${items.length} message(s) need a look`,
            messages: items.map((m) => ({
              id: m.id,
              from: m.from,
              subject: defuseDirectives(m.subject ?? ""),
              snippet: defuseDirectives(m.snippet ?? ""),
              unread: m.unread,
            })),
          },
        };
      }
      case "read_message": {
        if (!data?.id) return { ok: false, output: null, error: "id required" };
        const m = await readMessage(String(data.id));
        const { defuseDirectives } = await import("../../llm/directiveParser.ts");
        return {
          ok: true,
          output: {
            summary: `"${defuseDirectives(m.subject ?? "")}" from ${m.from}`,
            ...m,
            subject: defuseDirectives(m.subject ?? ""),
            body: m.body ? defuseDirectives(m.body) : m.body,
          },
        };
      }
      case "send": {
        const { stageGmailSend } = await import("../../gmail/send.ts");
        // By lead name → the outreach draft waiting for them (its stored draftId).
        if (data?.lead) {
          const { prisma } = await import("../../core/db/prisma.ts");
          const name = String(data.lead).trim();
          const lead = await prisma.lead.findFirst({
            where: { name: { contains: name, mode: "insensitive" } },
            orderBy: { updatedAt: "desc" },
          });
          if (!lead) return { ok: false, output: null, error: `No lead matching "${name}".` };
          if (!lead.outreachDraftId) return { ok: false, output: null, error: `No draft waiting for ${lead.name} — draft an outreach message first, then send it.` };
          if (!lead.email) return { ok: false, output: null, error: `${lead.name} has no email on file.` };
          const staged = await stageGmailSend({ draftId: lead.outreachDraftId, to: lead.email, subject: `Reply to ${lead.name}`, kind: "outreach", leadId: lead.id });
          if (!staged.ok) return { ok: false, output: null, error: staged.error };
          return { ok: true, output: { summary: `Send to ${lead.name} is waiting on your confirm — check the Bridge. Nothing goes out until you tap.`, bridgeSignalId: staged.bridgeSignalId } };
        }
        // Explicit draft → generic email send.
        if (data?.draftId && data?.to) {
          const staged = await stageGmailSend({ draftId: String(data.draftId), to: String(data.to), kind: "email" });
          if (!staged.ok) return { ok: false, output: null, error: staged.error };
          return { ok: true, output: { summary: `Send to ${data.to} is waiting on your confirm — check the Bridge.`, bridgeSignalId: staged.bridgeSignalId } };
        }
        return { ok: false, output: null, error: "Give a lead name, or a draftId + to." };
      }
      case "draft_reply": {
        if (!data?.to || !data?.subject || !data?.body) {
          return { ok: false, output: null, error: "to, subject, and body required" };
        }
        const r = await draftReply({
          to: String(data.to),
          subject: String(data.subject),
          body: String(data.body),
          threadId: data.threadId ? String(data.threadId) : undefined,
          inReplyToMessageId: data.inReplyToMessageId ? String(data.inReplyToMessageId) : undefined,
        });
        return {
          ok: true,
          output: { summary: `Draft saved to your Gmail — review and send there`, draftId: r.draftId },
        };
      }
      default:
        return { ok: false, output: null, error: `unknown gmail action: ${action}` };
    }
  },
};
