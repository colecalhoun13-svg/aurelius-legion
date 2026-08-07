// aurelius/crm/selfRecord.ts
//
// SELF-RECORDING PAYMENTS — money that logs itself, honestly.
//
// Cole wanted online payment where "paid" records itself instead of him typing
// it. This is that: a Stripe webhook (signature-verified) and a Venmo/Zelle/
// PayPal email parser both land a Payment with recordedBy set to HOW it was
// seen — never laundered into looking like Cole's hand. Two hard rules:
//
//   1. VERIFY, THEN TRUST. A webhook with no valid signature is refused. An
//      unsigned POST to a public URL is an attacker, not income.
//   2. IDEMPOTENT. The same externalRef never records twice — providers retry
//      webhooks, and a double-counted payment is a lie about the bank balance.
//
// A payment that can't be matched to a client is NOT dropped and NOT invented
// against a random client: it surfaces an unmatched-payment notice for Cole to
// attach by hand. Config-gated: dormant without STRIPE_WEBHOOK_SECRET.

import { createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "../core/db/prisma.ts";

export function stripeConfigured(): boolean {
  return !!process.env.STRIPE_WEBHOOK_SECRET;
}

/** Verify Stripe's `Stripe-Signature` header (t=…,v1=…) against the raw body. */
export function verifyStripeSignature(rawBody: Buffer | string, sigHeader: string | undefined, secret: string, toleranceSec = 300): boolean {
  if (!sigHeader || !secret) return false;
  const parts: Record<string, string> = {};
  for (const kv of sigHeader.split(",")) {
    const [k, v] = kv.split("=");
    if (k && v) parts[k.trim()] = v.trim();
  }
  const t = parts.t;
  const v1 = parts.v1;
  if (!t || !v1) return false;
  const ageSec = Math.abs(Date.now() / 1000 - Number(t));
  if (!Number.isFinite(ageSec) || ageSec > toleranceSec) return false; // replayed/old
  const payload = typeof rawBody === "string" ? rawBody : rawBody.toString("utf8");
  const expected = createHmac("sha256", secret).update(`${t}.${payload}`).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(v1));
  } catch {
    return false; // length mismatch
  }
}

const PAID_EVENTS = new Set(["checkout.session.completed", "payment_intent.succeeded", "charge.succeeded"]);

/** Turn a verified Stripe event into a recorded Payment (or an unmatched notice). */
export async function handleStripeEvent(event: any): Promise<{ recorded: boolean; reason: string }> {
  const type = event?.type;
  if (!PAID_EVENTS.has(type)) return { recorded: false, reason: `ignored event: ${type}` };
  const obj = event?.data?.object ?? {};
  // SUBSCRIPTION GUARD (council R2). A SUBSCRIPTION checkout.session.completed
  // carries `payment_intent: null` — it populates `subscription`/`invoice`
  // instead — so keying on `obj.id` (the session id) would record the monthly
  // signup under a key that does NOT match the payment_intent.succeeded +
  // charge.succeeded events fired for the same first invoice (those key on the
  // PI id). Result: the first month counted twice. Skip the PI-less session; the
  // payment_intent.succeeded event records that payment keyed on the PI, and
  // every renewal arrives as its own invoice/PI event too. A one-time
  // (mode=payment) session DOES carry a payment_intent and still records here.
  if (type === "checkout.session.completed" && !obj.payment_intent) {
    return { recorded: false, reason: "subscription/PI-less session — the payment_intent event records it" };
  }
  const amountCents = obj.amount_received ?? obj.amount_total ?? obj.amount ?? 0;
  const email = obj.customer_details?.email ?? obj.receipt_email ?? obj.billing_details?.email ?? null;
  // IDEMPOTENCY KEY = the payment_intent, NOT obj.id. One one-time checkout emits
  // all three PAID_EVENTS, each with a DIFFERENT obj.id (the session id, the
  // payment-intent id, the charge id) — keying on obj.id records the same $50
  // three times. All three carry the same payment_intent (payment_intent.succeeded
  // IS it; the session and charge both reference it), so keying there collapses
  // the trio to one Payment. The DB unique index on externalRef is the real guard
  // against a concurrent-delivery race (recordSelfPayment catches P2002); obj.id
  // is the last-ditch fallback only when a payment_intent is genuinely absent.
  const externalRef = obj.payment_intent ?? obj.id ?? event?.id ?? null;
  if (!amountCents || amountCents <= 0) return { recorded: false, reason: "event carried no amount" };
  return recordSelfPayment({ amountCents, email, method: "stripe", externalRef, recordedBy: "stripe_webhook" });
}

/** Parse a Venmo/Zelle/PayPal payment-notification email into a payment, or null
 *  if it isn't one. Heuristic on sender + subject — deliberately conservative:
 *  a false positive would record money that never arrived. */
export function parsePaymentEmail(input: { from: string; subject: string; body?: string }): {
  amountCents: number;
  payerName: string | null;
  method: string;
} | null {
  const from = (input.from ?? "").toLowerCase();
  const subject = input.subject ?? "";
  const text = `${subject}\n${input.body ?? ""}`;
  const method =
    /venmo\.com|venmo/.test(from) ? "venmo" :
    /zelle|ally|chase|bankofamerica|wellsfargo|zellepay/.test(from) ? "zelle" :
    /paypal\.com|paypal/.test(from) ? "paypal" : null;
  if (!method) return null;
  // "paid you $50.00", "sent you $50", "received $50.00 from"
  if (!/(paid you|sent you|received|you got)/i.test(text)) return null;
  const amt = /\$\s?([0-9]+(?:\.[0-9]{1,2})?)/.exec(text);
  if (!amt) return null;
  const amountCents = Math.round(Number(amt[1]) * 100);
  if (!Number.isFinite(amountCents) || amountCents <= 0) return null;
  // Payer: "Jane Doe paid you" / "from Jane Doe"
  const payer =
    /([A-Z][a-zA-Z.'-]+(?:\s+[A-Z][a-zA-Z.'-]+){0,2})\s+(?:paid you|sent you)/.exec(text)?.[1] ??
    /from\s+([A-Z][a-zA-Z.'-]+(?:\s+[A-Z][a-zA-Z.'-]+){0,2})/.exec(text)?.[1] ??
    null;
  return { amountCents, payerName: payer, method };
}

/** Surface a payment PARSED FROM AN EMAIL as a pending confirm — never auto-record
 *  it (council M3). An email From header is spoofable, so a Venmo/Zelle/PayPal
 *  notification is a *claim*, not a verified receipt: anyone who knows Cole's
 *  address could forge "Venmo: Jane paid you $500" and, under the old auto-record,
 *  poison the ledger and the earned-vs-motion truth the analyst reports. Stripe
 *  (HMAC) and Twilio (signature) are cryptographically verified and still
 *  self-record directly; only the email path stops here for Cole's tap.
 *
 *  Idempotent two ways: if the payment already recorded (Cole confirmed a prior
 *  poll's signal), skip — otherwise every 10-min inbox poll would re-ask about
 *  money already on the books. And the dedup seam in surfaceSignal collapses a
 *  still-pending confirm onto its open row, so one email = one ask. */
export async function surfacePaymentEmailForConfirm(input: {
  amountCents: number;
  email?: string | null;
  payerName?: string | null;
  method: string;
  externalRef: string; // `email:<gmail message id>` — the idempotency key
}): Promise<{ surfaced: boolean; reason: string }> {
  // Already on the books (a prior poll's confirm went through)? Don't re-ask.
  const already = await prisma.payment.findFirst({ where: { externalRef: input.externalRef }, select: { id: true } });
  if (already) return { surfaced: false, reason: "already recorded" };

  const { surfaceSignal } = await import("../core/bridge.ts");
  const { fromCents } = await import("./service.ts");
  await surfaceSignal({
    kind: "background_result",
    domain: "business",
    sourceType: "payment_email_confirm",
    sourceId: input.externalRef, // dedup: one email → one open ask
    severity: "attention",
    status: "pending",
    title: `Confirm: ${fromCents(input.amountCents)} via ${input.method}${input.payerName ? ` from ${input.payerName}` : ""}?`,
    body:
      `A ${input.method} email says a payment arrived` +
      `${input.payerName ? ` from ${input.payerName}` : ""}${input.email ? ` (${input.email})` : ""}. ` +
      `I don't auto-record these — an email sender is spoofable — so confirm and I'll log it (matched to the client, or filed as unmatched if I can't place them).`,
    actions: [
      {
        label: "Confirm & record",
        action: "confirm_action",
        payload: {
          actionClass: "payment.record",
          actionPayload: {
            amountCents: input.amountCents,
            email: input.email ?? null,
            payerName: input.payerName ?? null,
            method: input.method,
            externalRef: input.externalRef,
            recordedBy: "email_confirmed",
          },
        },
      },
      { label: "Dismiss", action: "dismiss", payload: {} },
    ],
  }).catch(() => {});
  return { surfaced: true, reason: "filed a payment confirm" };
}

/** Record a self-seen payment against a matched client, idempotently. */
export async function recordSelfPayment(input: {
  amountCents: number;
  email?: string | null;
  phone?: string | null;
  payerName?: string | null;
  method: string;
  externalRef?: string | null;
  recordedBy: string;
}): Promise<{ recorded: boolean; reason: string }> {
  if (input.externalRef) {
    const dup = await prisma.payment.findFirst({ where: { externalRef: input.externalRef }, select: { id: true } });
    if (dup) return { recorded: false, reason: "already recorded (idempotent)" };
  }
  // NAME-ONLY MATCH IS NOT SAFE ON AN AUTO-RECORD PATH (council R2). Two clients
  // named "Mike Johnson" + a Stripe receipt with no email → money booked against
  // the wrong athlete, silently, with no confirm. So self-recording matches on
  // VERIFIED identifiers only (email/phone); a name-only hit files an unmatched
  // notice for Cole to attach by hand rather than guessing.
  const client = await matchClient({ email: input.email, phone: input.phone }, { allowName: false });
  if (!client) {
    await surfaceUnmatchedPayment(input);
    return { recorded: false, reason: "no verified-identifier match — filed an unmatched-payment notice" };
  }
  const { recordPayment } = await import("./service.ts");
  try {
    await recordPayment({
      clientId: client.id,
      amount: input.amountCents / 100,
      method: input.method,
      externalRef: input.externalRef ?? undefined,
      recordedBy: input.recordedBy,
      note: input.payerName ? `Self-recorded via ${input.method} (${input.payerName})` : `Self-recorded via ${input.method}`,
    });
  } catch (err: any) {
    // The DB unique index on externalRef is the REAL idempotency guard — the
    // findFirst above is only a fast-path, and two concurrent webhook deliveries
    // of the same payment can both pass it before either commits. A P2002 here
    // means another delivery won the race: the payment is on the books exactly
    // once, which is success, not failure (council R2 TOCTOU fix).
    if (err?.code === "P2002") return { recorded: false, reason: "already recorded (idempotent — unique constraint)" };
    throw err;
  }
  return { recorded: true, reason: `recorded ${input.method} payment for ${client.name}` };
}

async function matchClient(
  by: { email?: string | null; phone?: string | null; name?: string | null },
  opts: { allowName?: boolean } = {}
) {
  const email = by.email?.trim().toLowerCase();
  const phone = by.phone?.replace(/[^0-9]/g, "");
  const or: any[] = [];
  if (email) or.push({ email: { equals: email, mode: "insensitive" } }, { parentEmail: { equals: email, mode: "insensitive" } });
  if (phone && phone.length >= 7) or.push({ phone: { contains: phone.slice(-10) } }, { parentPhone: { contains: phone.slice(-10) } });
  // Name is a fuzzy identifier — only used when a caller explicitly opts in (never
  // on an auto-record path). Two athletes can share a name; money must not guess.
  if (opts.allowName && by.name?.trim()) or.push({ name: { equals: by.name.trim(), mode: "insensitive" } });
  if (or.length === 0) return null;
  return prisma.client.findFirst({ where: { status: { not: "ended" }, OR: or }, select: { id: true, name: true } });
}

async function surfaceUnmatchedPayment(input: { amountCents: number; email?: string | null; payerName?: string | null; method: string; externalRef?: string | null }) {
  const { surfaceSignal } = await import("../core/bridge.ts");
  const { fromCents } = await import("./service.ts");
  await surfaceSignal({
    kind: "opportunity",
    domain: "business",
    sourceType: "unmatched_payment",
    sourceId: `payment:${input.externalRef ?? `${input.method}:${input.amountCents}:${input.email ?? input.payerName ?? "?"}`}`,
    severity: "attention",
    title: `${fromCents(input.amountCents)} arrived via ${input.method} — but no matching client`,
    body:
      `A payment landed that I couldn't attach to anyone in the roster` +
      `${input.payerName ? ` (from ${input.payerName})` : ""}${input.email ? ` (${input.email})` : ""}. ` +
      `It's real money — add the client (or fix their email/phone) and I'll match the next one automatically.`,
  }).catch(() => {});
}
