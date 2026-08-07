// aurelius/crm/trackLinks.ts
//
// THE REF-LINK EMITTER — the emit side attribution never had.
//
// Before this, the only "trackable link" in the system was a copy-pasted
// `/start?ref=<first-8-chars-of-a-draft-id>` string: no click count, no
// identity of its own, and a resolver that silently dropped attribution when
// two ids shared a prefix. This mints a REAL link: a unique short code, a row
// that records the channel/angle/offer it belongs to, and a click counter the
// public `/l/:code` redirect bumps on every open.
//
// The whole point is that the first ten leads TELL Cole which channel and which
// angle actually work — instead of him guessing, which is the exact thing the
// business was built to stop.

import { prisma } from "../core/db/prisma.ts";
import { randomBytes } from "node:crypto";

// URL-safe, unambiguous alphabet — no l/1/o/0 so a code read off a screen or a
// story can't be mistyped into a different (or non-existent) link.
const ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";

function makeCode(len = 7): string {
  const bytes = randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) out += ALPHABET[bytes[i]! % ALPHABET.length];
  return out;
}

export type MintInput = {
  channel?: string; // "instagram" | "email" | "warm_list" | "offer_probe" | "website" | "other"
  label?: string;
  angleId?: string | null;
  offerId?: string | null;
  artifactId?: string | null;
  destination?: string; // where /l/:code sends them (default /start)
};

/** Mint a new tracked link with a guaranteed-unique code. */
export async function mintTrackLink(input: MintInput): Promise<{ id: string; code: string }> {
  // Retry on the (astronomically rare) code collision rather than trust one draw.
  for (let attempt = 0; attempt < 6; attempt++) {
    const code = makeCode(attempt < 3 ? 7 : 9); // widen after a couple misses
    const existing = await prisma.trackLink.findUnique({ where: { code }, select: { id: true } });
    if (existing) continue;
    const row = await prisma.trackLink.create({
      data: {
        code,
        channel: input.channel ?? "other",
        label: input.label ?? null,
        angleId: input.angleId ?? null,
        offerId: input.offerId ?? null,
        artifactId: input.artifactId ?? null,
        destination: input.destination ?? "/start",
      },
      select: { id: true, code: true },
    });
    return row;
  }
  throw new Error("[trackLinks] could not mint a unique code after 6 attempts");
}

/** The public origin, when Cole has configured one. Without it, only relative
 *  links are possible — the FE can still build absolute URLs from its own
 *  window.location, but a BACKEND-generated message (a publish confirm, an
 *  outreach draft) needs this to hand over a clickable link. */
export function publicOrigin(): string | null {
  const raw = process.env.APP_PUBLIC_URL || process.env.MEDIA_PUBLIC_BASE_URL || "";
  return raw ? raw.replace(/\/+$/, "") : null;
}

/** The clickable URL for a code — absolute when an origin is configured, else a
 *  relative path plus the honest reason it isn't clickable yet. */
export function trackLinkUrl(code: string): { url: string; absolute: boolean; note?: string } {
  const origin = publicOrigin();
  if (origin) return { url: `${origin}/l/${code}`, absolute: true };
  return {
    url: `/l/${code}`,
    absolute: false,
    note: "Set APP_PUBLIC_URL (or MEDIA_PUBLIC_BASE_URL) to your public origin and this becomes a clickable link.",
  };
}

/** Look up a link by its code. */
export function resolveTrackLink(code: string) {
  return prisma.trackLink.findUnique({ where: { code } });
}

/** Bump the click counter. Fire-and-forget safe — a lost click must never 500
 *  the redirect that carries a real person to the form. */
export async function countClick(code: string): Promise<void> {
  await prisma.trackLink.update({ where: { code }, data: { clickCount: { increment: 1 } } }).catch(() => {});
}

export type AttributionKind = "click" | "intake" | "inbound" | "reply" | "converted" | "paid";

/** Record one touch in a lead's journey. Everything is optional except kind —
 *  a click has no lead yet, a paid event carries amountCents. This is the ledger
 *  the analyst reads to answer "which channel actually earned". */
export async function recordAttribution(input: {
  kind: AttributionKind;
  channel?: string;
  refCode?: string | null;
  trackLinkId?: string | null;
  angleId?: string | null;
  leadId?: string | null;
  clientId?: string | null;
  paymentId?: string | null;
  amountCents?: number | null;
  metadata?: any;
  occurredAt?: Date;
}): Promise<void> {
  await prisma.attributionEvent
    .create({
      data: {
        kind: input.kind,
        channel: input.channel ?? "other",
        refCode: input.refCode ?? null,
        trackLinkId: input.trackLinkId ?? null,
        angleId: input.angleId ?? null,
        leadId: input.leadId ?? null,
        clientId: input.clientId ?? null,
        paymentId: input.paymentId ?? null,
        amountCents: input.amountCents ?? null,
        metadata: input.metadata ?? undefined,
        occurredAt: input.occurredAt ?? new Date(),
      },
    })
    // Attribution is a record, not a gate: a failed write must never break the
    // real thing that happened (a lead captured, a payment recorded).
    .catch((err) => console.warn("[trackLinks] recordAttribution failed (non-fatal):", (err as any)?.message ?? err));
}

/** List links for the Business page, newest first, with their click counts. */
export function listTrackLinks(opts: { channel?: string; limit?: number } = {}) {
  return prisma.trackLink.findMany({
    where: opts.channel ? { channel: opts.channel } : {},
    orderBy: { createdAt: "desc" },
    take: opts.limit ?? 50,
    include: { _count: { select: { leads: true, events: true } } },
  });
}
