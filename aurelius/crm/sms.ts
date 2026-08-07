// aurelius/crm/sms.ts
//
// TWILIO SMS — inbound self-records, outbound is Cole's confirm.
//
// Cole wanted phone/SMS where an inbound text records itself against the person
// it came from. This does that: a verified inbound webhook matches the sender's
// number to a lead or client, logs the touch, and (for a contacted lead) flips
// it to conversing — the same warm signal the Gmail reply-matcher produces.
//
// Outbound is the opposite of automatic: sending a text to a real person is an
// OUTWARD action (sms.send), non-grantable, gated on Cole's confirm every time.
// And 10DLC is real: a US business number must be registered on a 10DLC campaign
// before carriers deliver its A2P traffic — so this stays dormant-honest until
// TWILIO_AUTH_TOKEN + a from-number are set AND the number is registered.

import { createHmac } from "node:crypto";
import { prisma } from "../core/db/prisma.ts";

export function twilioConfigured(): boolean {
  return !!(process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_FROM_NUMBER);
}

/** Verify Twilio's X-Twilio-Signature: base64(HMAC-SHA1(authToken, url + sorted
 *  param key+value concatenation)). */
export function verifyTwilioSignature(url: string, params: Record<string, any>, sigHeader: string | undefined, authToken: string): boolean {
  if (!sigHeader || !url) return false;
  const sorted = Object.keys(params).sort();
  let data = url;
  for (const k of sorted) data += k + String(params[k] ?? "");
  const expected = createHmac("sha1", authToken).update(Buffer.from(data, "utf8")).digest("base64");
  // Constant-ish comparison; lengths equal for base64 sha1.
  if (expected.length !== sigHeader.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ sigHeader.charCodeAt(i);
  return diff === 0;
}

/** An inbound text — match it to a person and record the touch. */
export async function handleInboundSms(input: { from: string; body: string }): Promise<{ matched: boolean; reason: string }> {
  const digits = (input.from ?? "").replace(/[^0-9]/g, "");
  if (digits.length < 7) return { matched: false, reason: "no usable number" };
  const tail = digits.slice(-10);
  const norm = (p: string | null | undefined) => (p ?? "").replace(/[^0-9]/g, "");
  const matches = (p: string | null | undefined) => {
    const d = norm(p);
    return d.length >= 7 && d.slice(-10) === tail;
  };
  // Prefilter cheaply on the last 4 digits (survives formatting like
  // "(555) 123-4567"), then confirm on normalised digits — a stored number's
  // spaces/parens break a contiguous `contains` match.
  const last4 = tail.slice(-4);

  const leadCandidates = await prisma.lead.findMany({
    where: { phone: { contains: last4 }, status: { notIn: ["won", "lost"] } },
    select: { id: true, name: true, status: true, angleId: true, source: true, refCode: true, trackLinkId: true, phone: true },
    take: 25,
  });
  const lead = leadCandidates.find((l) => matches(l.phone)) ?? null;
  let client: { id: string; name: string } | null = null;
  if (!lead) {
    const clientCandidates = await prisma.client.findMany({
      where: { OR: [{ phone: { contains: last4 } }, { parentPhone: { contains: last4 } }] },
      select: { id: true, name: true, phone: true, parentPhone: true },
      take: 25,
    });
    client = clientCandidates.find((c) => matches(c.phone) || matches(c.parentPhone)) ?? null;
  }

  const { recordAttribution } = await import("./trackLinks.ts");
  const { surfaceSignal } = await import("../core/bridge.ts");

  if (lead) {
    // A text from a contacted lead is a reply — flip to conversing, credit angle.
    if (lead.status === "contacted") {
      await prisma.lead.update({
        where: { id: lead.id },
        data: { status: "conversing", lastContactAt: new Date(), nextAction: "They texted back — keep it going", nextActionAt: new Date() },
      });
      if (lead.angleId) await prisma.marketingAngle.update({ where: { id: lead.angleId }, data: { replies: { increment: 1 } } }).catch(() => {});
    }
    await recordAttribution({ kind: "reply", channel: "sms", leadId: lead.id, angleId: lead.angleId, refCode: lead.refCode, trackLinkId: lead.trackLinkId });
    await surfaceSignal({
      kind: "opportunity", domain: "business", sourceType: "sms_inbound", sourceId: `sms:${lead.id}:${Date.now()}`,
      severity: "attention", title: `${lead.name} texted you`,
      body: `"${input.body.slice(0, 300)}"\n\nThey're warm — reply from your phone (I don't send texts on my own).`,
    }).catch(() => {});
    return { matched: true, reason: "matched a lead" };
  }
  if (client) {
    await recordAttribution({ kind: "inbound", channel: "sms", clientId: client.id });
    await surfaceSignal({
      kind: "opportunity", domain: "business", sourceType: "sms_inbound", sourceId: `sms:${client.id}:${Date.now()}`,
      severity: "notice", title: `${client.name} texted you`,
      body: `"${input.body.slice(0, 300)}"`,
    }).catch(() => {});
    return { matched: true, reason: "matched a client" };
  }

  // Unknown number — capture as an inbound touch so it isn't lost, and notify.
  await surfaceSignal({
    kind: "opportunity", domain: "business", sourceType: "sms_inbound", sourceId: `sms:unknown:${digits}:${Date.now()}`,
    severity: "notice", title: `Text from an unknown number`,
    body: `${input.from}: "${input.body.slice(0, 300)}"\n\nNobody in the roster matches this number — add them if it's a lead.`,
  }).catch(() => {});
  return { matched: false, reason: "no match — filed a notice" };
}

/** Send an SMS via Twilio. The finalizer for the OUTWARD sms.send action — runs
 *  ONLY on Cole's confirm. Dormant-honest without config (fails loudly, once). */
export async function sendSms(payload: { to: string; body: string }): Promise<{ ok: boolean; sid?: string; error?: string }> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;
  if (!sid || !token || !from) {
    throw new Error("Twilio is not configured — set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_FROM_NUMBER (and register the number on 10DLC).");
  }
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ To: payload.to, From: from, Body: payload.body }).toString(),
  });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Twilio send failed: ${json?.message ?? res.status}`);
  return { ok: true, sid: json.sid };
}
