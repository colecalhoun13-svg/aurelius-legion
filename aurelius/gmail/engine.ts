// aurelius/gmail/engine.ts
//
// GMAIL ENGINE (OG doc Part VII) — read broadly, write NARROWLY. Aurelius
// reads the inbox to flag what needs Cole and drafts replies for his review.
// Sending exists but is OUTWARD by construction: sendDraft() only ever runs
// inside the email.send / outreach.send finalizers, which the executor gates
// as outward classes — so a message leaves only on Cole's explicit confirm,
// NEVER autonomously and NEVER on a grant. "Aurelius emailed someone without
// me" stays impossible; "Aurelius emailed someone the instant I tapped Send"
// is the whole point of wiring the send.
//
// Dormant until the one-time OAuth (/api/gmail/auth). The gmail.send scope is
// explicit in the grant so the capability is declared, not smuggled through
// compose — connecting Gmail now asks for send permission, and the doctor
// reports it. Every entry point fails honestly with the connect instruction.

import { makeGoogleOAuth } from "../google/oauth.ts";

export const gmailAuth = makeGoogleOAuth({
  service: "gmail",
  // readonly = read · compose = create drafts · send = deliver (gated outward).
  scope: "https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.compose https://www.googleapis.com/auth/gmail.send",
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
  // Freshness heartbeat — the inbox was actually read just now.
  await import("../core/connectorFreshness.ts").then((mod) => mod.recordConnectorRead("gmail")).catch(() => {});
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
  /**
   * FALSE FOR FIRST CONTACT. Default true because this function was written
   * for inbox triage, where every draft genuinely is a reply.
   */
  isReply?: boolean;
}): Promise<{ draftId: string; threadId?: string }> {
  // Build a minimal RFC 2822 message, base64url-encoded.
  //
  // The `Re:` was unconditional. Outreach passes a fresh subject ("Quick one,
  // Sarah"), so every first-contact message on the warm list shipped as
  // "Re: Quick one, Sarah" — a forged reply thread, to someone who has never
  // emailed Cole, as the first impression of his business. The warm list is
  // the only channel that works at zero audience and it does not regenerate.
  //
  // Threading identity is the honest signal: a message that is genuinely part
  // of a thread carries a thread or an In-Reply-To. Absent both, and absent an
  // explicit isReply, it is a first contact whatever the subject says.
  const threaded = input.isReply ?? !!(input.threadId || input.inReplyToMessageId);
  const subject =
    threaded && !input.subject.startsWith("Re:") ? `Re: ${input.subject}` : input.subject;
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
  // Expose the thread so a caller (outreach) can persist it and later match an
  // inbound reply on the same thread back to the lead it was drafted for.
  return { draftId: json.id, threadId: json.message?.threadId as string | undefined };
}

/**
 * Read back a draft's recipient + subject + body — so the SEND confirm card can
 * show Cole the exact words that will go out (the review IS the one tap). The
 * draft may have been LLM-composed from an inbound message, so this is the point
 * where Cole actually sees it before anything leaves.
 */
export async function readDraft(draftId: string): Promise<{ to: string; subject: string; body: string } | null> {
  if (!draftId) return null;
  const res = await gmailAuth.fetch(`${API}/drafts/${draftId}?format=full`, {});
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok || !json.message) return null;
  const headers = json.message.payload?.headers ?? [];
  return {
    to: header(headers, "To"),
    subject: header(headers, "Subject"),
    body: extractText(json.message.payload).trim(),
  };
}

/**
 * SEND an existing draft — OUTWARD. This is the only function that actually
 * puts a message in someone's inbox, and it is called ONLY from the
 * email.send / outreach.send finalizers, which the executor gates as outward
 * classes. So it runs on Cole's confirm, never on its own and never on a grant.
 * Sends the draft Cole reviewed (its exact bytes), so what goes out is what he
 * saw. Fails loudly (dormant Gmail, revoked send scope, deleted draft).
 */
export async function sendDraft(draftId: string): Promise<{ messageId: string; threadId?: string }> {
  if (!draftId) throw new Error("Nothing to send — no draft id.");
  const res = await gmailAuth.fetch(`${API}/drafts/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: draftId }),
  });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok || !json.id) {
    const msg = json?.error?.message ?? `HTTP ${res.status}`;
    // A 403 here is almost always the missing send scope on an older grant.
    throw new Error(
      /insufficient|scope|permission|403/i.test(msg)
        ? `Gmail send was refused (${msg}). Reconnect Gmail at /api/gmail/auth to grant send permission — the older grant was draft-only.`
        : `Send failed: ${msg}`
    );
  }
  return { messageId: json.id, threadId: json.threadId as string | undefined };
}
