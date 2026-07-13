// aurelius/tools/adapters/gmail.ts
//
// GMAIL as a registered tool — Aurelius reads the inbox and drafts
// replies via [TOOL: ...] directives. Draft-only by construction: the
// OAuth grant has no send scope, so create_draft lands in Cole's Gmail
// drafts and nothing leaves without him hitting send. Honest-dormant
// until the one-time /api/gmail/auth.

import type { ToolAdapter, ToolAdapterResult } from "../types.ts";
import { gmailAuth, listInbox, readMessage, draftReply } from "../../gmail/engine.ts";

const NOT_CONNECTED = "Gmail not connected — open /api/gmail/auth once to authorize (read + draft only)";

export const gmailAdapter: ToolAdapter = {
  name: "gmail",
  description:
    "Gmail (read + draft only, never sends): scan the inbox for what needs Cole, read a message, draft a reply for his review.",
  actions: [
    {
      name: "read_inbox",
      description: "Recent messages worth attention (unread + important, last 7 days by default).",
      dataSchema: '{ max?: number, query?: string (Gmail search, e.g. "is:starred") }',
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
        return {
          ok: true,
          output: {
            summary: `${items.length} message(s) need a look`,
            messages: items.map((m) => ({
              id: m.id,
              from: m.from,
              subject: m.subject,
              snippet: m.snippet,
              unread: m.unread,
            })),
          },
        };
      }
      case "read_message": {
        if (!data?.id) return { ok: false, output: null, error: "id required" };
        const m = await readMessage(String(data.id));
        return { ok: true, output: { summary: `"${m.subject}" from ${m.from}`, ...m } };
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
