// aurelius/instagram/messages.ts
//
// INSTAGRAM DM DOOR — inbound only, capture only.
//
// Mirrors the Twilio pattern (crm/sms.ts + /webhooks/twilio): a signature-
// verified Meta webhook delivers inbound DMs, each one is matched to (or
// creates) a Lead with source "instagram", and a Bridge opportunity tells
// Cole someone knocked. That is the ENTIRE surface: this module never sends,
// never auto-replies, never touches the Graph send API. Replying to a DM is
// Cole, in the Instagram app, with his thumbs — a reply from "the coach's
// assistant bot" would poison the one channel that might someday produce
// inbound.
//
// Dormant-honest (hard rule 4): without INSTAGRAM_APP_SECRET the route 503s
// with the config line, and without META_VERIFY_TOKEN Meta's own subscription
// handshake cannot complete — so a half-configured door stays visibly shut
// instead of silently open.

import { createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "../core/db/prisma.ts";

export function instagramMessagesConfigured(): boolean {
  return !!(
    (process.env.INSTAGRAM_APP_SECRET ?? process.env.META_APP_SECRET)?.trim() &&
    process.env.META_VERIFY_TOKEN?.trim()
  );
}

/**
 * Verify Meta's X-Hub-Signature-256 header: "sha256=" + hex HMAC-SHA256 of the
 * RAW request body under the app secret. Must be the exact bytes Express read
 * (req.rawBody) — a re-serialised JSON object cannot reproduce them.
 */
export function verifyMetaSignature(
  raw: Buffer | undefined,
  sigHeader: string | undefined,
  appSecret: string
): boolean {
  if (!raw || !sigHeader?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", appSecret).update(raw).digest("hex");
  const got = sigHeader.slice("sha256=".length).trim().toLowerCase();
  if (got.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(got, "utf8"), Buffer.from(expected, "utf8"));
  } catch {
    return false;
  }
}

/** Best-effort display name for an IG-scoped sender id. Needs the connected
 *  account's token; without one the id's tail is the honest fallback — never
 *  a guessed name. */
async function igDisplayName(igUserId: string): Promise<string | null> {
  const token = process.env.INSTAGRAM_ACCESS_TOKEN?.trim();
  if (!token) return null;
  try {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${encodeURIComponent(igUserId)}?fields=name,username&access_token=${encodeURIComponent(token)}`
    );
    if (!res.ok) return null;
    const j: any = await res.json().catch(() => null);
    if (j?.username) return `@${String(j.username).slice(0, 60)}`;
    if (j?.name) return String(j.name).slice(0, 60);
    return null;
  } catch {
    return null;
  }
}

/** Flatten webhook payload → inbound text messages. Skips echoes (our own
 *  account's sends), read receipts, reactions — anything without inbound text. */
function extractInboundDms(payload: any): Array<{ senderId: string; text: string; mid: string | null }> {
  const out: Array<{ senderId: string; text: string; mid: string | null }> = [];
  for (const entry of Array.isArray(payload?.entry) ? payload.entry : []) {
    for (const ev of Array.isArray(entry?.messaging) ? entry.messaging : []) {
      const senderId = String(ev?.sender?.id ?? "").replace(/[^0-9]/g, "");
      const msg = ev?.message;
      if (!senderId || !msg || msg.is_echo) continue;
      // Sanitise: collapse whitespace, cap length — this string lands in a
      // Lead row and a Bridge signal, and a stranger wrote it.
      const text = String(msg.text ?? "").replace(/\s+/g, " ").trim().slice(0, 500);
      if (!text) continue; // attachment-only / reaction — nothing to file yet
      out.push({ senderId, text, mid: msg.mid ? String(msg.mid).slice(0, 120) : null });
    }
  }
  return out;
}

/**
 * Handle a verified webhook delivery. For each inbound DM: match the sender's
 * IG id to an existing lead (refCode carries "ig:<id>" — a stable identity a
 * DM can be re-matched on) or create one with source "instagram", then surface
 * the opportunity. Idempotent-ish under Meta's redelivery: the lead match
 * prevents duplicates, and surfaceSignal dedups on the message id.
 */
export async function handleInstagramMessages(payload: any): Promise<{
  received: number; captured: number; skipped: number;
}> {
  const dms = extractInboundDms(payload);
  if (dms.length === 0) return { received: 0, captured: 0, skipped: 0 };

  const { surfaceSignal } = await import("../core/bridge.ts");
  const { recordAttribution } = await import("../crm/trackLinks.ts");

  let captured = 0;
  for (const dm of dms) {
    const refCode = `ig:${dm.senderId}`;
    let lead = await prisma.lead.findFirst({ where: { refCode } });

    if (lead) {
      // A DM from someone already in the pipeline is a warm touch — same
      // semantics as an inbound text: contacted → conversing.
      await prisma.lead.update({
        where: { id: lead.id },
        data: {
          lastContactAt: new Date(),
          ...(lead.status === "contacted"
            ? { status: "conversing", nextAction: "They DM'd back on Instagram — keep it going", nextActionAt: new Date() }
            : {}),
        },
      }).catch(() => {});
    } else {
      const name = (await igDisplayName(dm.senderId)) ?? `Instagram DM · …${dm.senderId.slice(-6)}`;
      lead = await prisma.lead.create({
        data: {
          name,
          source: "instagram",
          refCode, // the IG-scoped sender id, so the next DM matches this row
          notes: `Inbound Instagram DM (IG user id ${dm.senderId}): "${dm.text}"`,
          nextAction: "They DM'd you on Instagram — reply from the app",
          nextActionAt: new Date(),
          lastContactAt: new Date(),
        },
      });
    }

    await recordAttribution({ kind: "inbound", channel: "instagram", leadId: lead.id }).catch(() => {});
    await surfaceSignal({
      kind: "opportunity",
      domain: "business",
      sourceType: "instagram_dm",
      sourceId: dm.mid ? `igdm:${dm.mid}` : `igdm:${dm.senderId}:${Date.now()}`,
      severity: "attention",
      title: `IG DM from ${lead.name}`,
      body: `"${dm.text}"\n\nCapture-only — I never reply to DMs on my own. Answer from the Instagram app; they're in the pipeline as a lead.`,
    }).catch(() => {});
    captured++;
  }

  return { received: dms.length, captured, skipped: dms.length - captured };
}
