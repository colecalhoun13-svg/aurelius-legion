// aurelius/gmail/engine.ts
//
// GMAIL ENGINE (OG doc Part VII) — read broadly, write NARROWLY. Aurelius
// reads the inbox to flag what needs Cole and drafts replies for his
// review, but NEVER sends. Scopes are readonly + compose (draft-only);
// there is no send scope in the grant, so "Aurelius emailed someone
// without me" is impossible by construction, not just by policy.
//
// Dormant until the one-time OAuth (/api/gmail/auth). Every entry point
// fails honestly with the connect instruction.

import { makeGoogleOAuth } from "../google/oauth.ts";

export const gmailAuth = makeGoogleOAuth({
  service: "gmail",
  // readonly = read messages · compose = create drafts. No send scope.
  scope: "https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.compose",
  callbackPath: "/api/gmail/callback",
  tokenKey: "google_gmail_tokens",
});

const API = "https://gmail.googleapis.com/gmail/v1/users/me";

function header(headers: any[], name: string): string {
  return headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? "";
}

// Decode Gmail's base64url message bodies.
function decodeBody(part: any): string {
  const data = part?.body?.data;
  if (!data) return "";
  try {
    return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
  } catch {
    return "";
  }
}

function extractText(payload: any): string {
  if (!payload) return "";
  if (payload.mimeType === "text/plain") return decodeBody(payload);
  if (payload.parts) {
    for (const p of payload.parts) {
      const t = extractText(p);
      if (t) return t;
    }
  }
  return decodeBody(payload);
}

export type InboxItem = {
  id: string;
  threadId: string;
  from: string;
  subject: string;
  snippet: string;
  date: string;
  unread: boolean;
};

/**
 * Recent messages worth Cole's attention — unread + important by default,
 * newest first. `query` overrides the Gmail search (e.g. "is:starred").
 */
export async function listInbox(opts: { max?: number; query?: string } = {}): Promise<InboxItem[]> {
  const max = Math.min(opts.max ?? 10, 25);
  const q = encodeURIComponent(opts.query ?? "is:unread (is:important OR in:inbox) newer_than:7d");
  const listRes = await gmailAuth.fetch(`${API}/messages?maxResults=${max}&q=${q}`);
  if (!listRes.ok) throw new Error(`gmail list failed: ${listRes.status}`);
  const listJson: any = await listRes.json();
  const ids: string[] = (listJson.messages ?? []).map((m: any) => m.id);

  const items: InboxItem[] = [];
  for (const id of ids) {
    const res = await gmailAuth.fetch(
      `${API}/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`
    );
    if (!res.ok) continue;
    const m: any = await res.json();
    items.push({
      id: m.id,
      threadId: m.threadId,
      from: header(m.payload?.headers ?? [], "From"),
      subject: header(m.payload?.headers ?? [], "Subject") || "(no subject)",
      snippet: (m.snippet ?? "").slice(0, 200),
      date: header(m.payload?.headers ?? [], "Date"),
      unread: (m.labelIds ?? []).includes("UNREAD"),
    });
  }
  return items;
}

/** One message, full text — for when Cole wants the whole thing. */
export async function readMessage(id: string): Promise<{ from: string; subject: string; date: string; body: string }> {
  const res = await gmailAuth.fetch(`${API}/messages/${id}?format=full`);
  if (!res.ok) throw new Error(`gmail read failed: ${res.status}`);
  const m: any = await res.json();
  const headers = m.payload?.headers ?? [];
  return {
    from: header(headers, "From"),
    subject: header(headers, "Subject") || "(no subject)",
    date: header(headers, "Date"),
    body: extractText(m.payload).slice(0, 8000),
  };
}

/**
 * Create a DRAFT reply — lands in Cole's Gmail drafts for his review and
 * send. Aurelius cannot send; the grant has no send scope.
 */
export async function draftReply(input: {
  to: string;
  subject: string;
  body: string;
  threadId?: string;
  inReplyToMessageId?: string;
}): Promise<{ draftId: string }> {
  // Build a minimal RFC 2822 message, base64url-encoded.
  const subject = input.subject.startsWith("Re:") ? input.subject : `Re: ${input.subject}`;
  const lines = [
    `To: ${input.to}`,
    `Subject: ${subject}`,
    "Content-Type: text/plain; charset=UTF-8",
    ...(input.inReplyToMessageId ? [`In-Reply-To: ${input.inReplyToMessageId}`, `References: ${input.inReplyToMessageId}`] : []),
    "",
    input.body,
  ];
  const raw = Buffer.from(lines.join("\r\n"), "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const res = await gmailAuth.fetch(`${API}/drafts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: { raw, threadId: input.threadId } }),
  });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok || !json.id) throw new Error(`draft create failed: ${json?.error?.message ?? res.status}`);
  return { draftId: json.id };
}
