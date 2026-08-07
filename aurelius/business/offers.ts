// aurelius/business/offers.ts
//
// THE OFFER — the artifact everything else points at.
//
// Before this file, `proposeOffer` produced a paragraph inside a knowledge
// proposal. That is not an offer; it is a description of one. The practical
// consequence was that every marketing angle, every outreach draft and every
// landing section re-improvised the promise, the shape and (worst) the price.
// Cole could not sell the same thing twice, and Aurelius could not check
// whether the thing it was marketing was the thing he actually sells.
//
// Rules that hold here:
//
//   1. AN OFFER IS A ROW, NOT PROSE. Name, audience, promise, shape, price.
//      Marketing reads it. Outreach reads it. An Engagement records which one
//      was sold, which closes the chain angle → lead → offer → engagement →
//      payment.
//   2. PRICE IS NEVER INVENTED. Cole has not set remote pricing yet. A drafted
//      offer leaves `priceCents` NULL and says so out loud. A confident wrong
//      price is the single most expensive hallucination this system could make
//      — he would quote it.
//   3. ONLY COLE ACTIVATES. Drafting is inward and reversible. Making an offer
//      LIVE — the thing his marketing then points every stranger at — is his
//      hand, always. Nothing in here activates on its own.
//   4. NO ACTIVE OFFER IS A FIRST-CLASS STATE, LOUDLY REPORTED. Marketing with
//      nothing to sell is decoration, and the system says that rather than
//      rendering a tidy empty panel.

import { prisma } from "../core/db/prisma.ts";
import { runLLM } from "../llm/runLLM.ts";
import { engineUnavailableText } from "../llm/nonAnswer.ts";
// IMPORTED, not re-derived. This translation was written twice, character-
// identically, and was wrong in both places — the council found it in both
// files as one defect. One function means the next edit can't fix half of it.
import { groundingFromResearch, type Grounding } from "./marketing.ts";

/** Same vocabulary as Engagement.shape, so a sale needs no translation. */
export const OFFER_SHAPES = ["monthly", "block", "program"] as const;
export type OfferShape = (typeof OFFER_SHAPES)[number];

export type ParsedOffer = {
  name: string;
  audience: string;
  promise: string;
  shape: OfferShape;
  format?: string;
  proof?: string;
  edge?: string;
  assumptions?: string;
  durationWeeks?: number;
};

// ── 1. DRAFTING ──────────────────────────────────────────────────────

/**
 * PURE — parse a drafted offer out of the model's reply. Extracted so the
 * parsing is testable with no key, no network and no database.
 *
 * Returns null rather than a half-offer: a row missing its promise is worse
 * than no row, because it looks like something.
 */
export function parseOffer(text: string): ParsedOffer | null {
  const grab = (label: string) =>
    new RegExp(`^${label}:\\s*([\\s\\S]*?)(?=\\n[A-Z][A-Z ]{2,}:|$)`, "im").exec(text)?.[1]?.trim() ?? "";

  const name = grab("NAME");
  const promise = grab("PROMISE");
  const audience = grab("WHO") || grab("AUDIENCE");
  if (!name || !promise || !audience) return null;

  const rawShape = grab("SHAPE").toLowerCase();
  const shape: OfferShape =
    /monthly|retainer|ongoing/.test(rawShape) ? "monthly"
    : /program|one-?off|one time/.test(rawShape) ? "program"
    : "block";

  // Weeks only if the model actually stated a number. "8-12 weeks" takes the
  // low end — under-promising a duration is the safe direction.
  const weeks = /(\d{1,2})\s*(?:-|–|to)?\s*(?:\d{1,2})?\s*weeks?/i.exec(grab("SHAPE") + " " + grab("FORMAT"));
  const durationWeeks = weeks ? Number(weeks[1]) : undefined;

  return {
    name: name.split("\n")[0].slice(0, 120),
    audience: audience.slice(0, 500),
    promise: promise.slice(0, 2000),
    shape,
    format: grab("FORMAT") || grab("SHAPE") || undefined,
    proof: grab("PROOF") || undefined,
    edge: grab("WHY HIM") || grab("EDGE") || undefined,
    assumptions: grab("ASSUMPTIONS") || undefined,
    durationWeeks: durationWeeks && durationWeeks > 0 && durationWeeks <= 52 ? durationWeeks : undefined,
  };
}

/**
 * Draft ONE offer as a durable draft row, research-informed and honestly
 * labelled. Inward: it writes a draft nobody is selling yet.
 *
 * Deliberately NOT auto-activated. See rule 3.
 */
export async function draftOffer(opts: { shape?: OfferShape } = {}): Promise<{
  ok: boolean;
  offerId?: string;
  offer?: ParsedOffer;
  grounding?: Grounding;
  groundingNote?: string;
  error?: string;
}> {
  const { businessContextBlock, businessResearchContext } = await import("./positioning.ts");
  const context = await businessContextBlock();

  let researchText = "";
  let grounding: Grounding = "none";
  let sources: Array<{ title: string; url?: string; source: string }> = [];
  try {
    const { runResearch } = await import("../research/researchEngine.ts");
    const res: any = await runResearch({
      query:
        `How independent coaches structure and price REMOTE athletic coaching offers — formats, check-in ` +
        `cadence, contract length, and what buyers respond to when they never meet the coach in person. ` +
        `Context: ${await businessResearchContext()}`,
      operator: "business",
      depth: "deep",
      subject: "how remote coaching offers are structured and priced",
      kind: "topic",
    });
    const body = [res?.synthesis, ...(res?.insights ?? [])].filter(Boolean).join("\n\n");
    if (body && !engineUnavailableText(body)) {
      researchText = body.slice(0, 5000);
      sources = (res?.rawResults ?? [])
        .filter((r: any) => r.source !== "llm" && r.url)
        .slice(0, 6)
        .map((r: any) => ({ title: r.title, url: r.url, source: r.source }));
      // An offer has no "own results" to fall back on — there are no prior
      // offers to have performed. So it is external-with-sources, or it is a
      // guess and says so. This is the price Cole would quote a parent.
      grounding = groundingFromResearch(res?.grounding, sources.length, false);
    }
  } catch {
    /* research down — draft anyway, labelled as a guess */
  }

  const shapeLine = opts.shape
    ? `Write it as a "${opts.shape}" offer.`
    : `Pick whichever of Cole's three shapes (monthly retainer · 8-12 week block · one-off program) this promise actually fits, and say which.`;

  const res = await runLLM({
    taskType: "chat",
    operators: { primary: "business", secondaries: ["content"] },
    noReuse: true,
    omitToolCatalog: true,
    input:
      `${context}\n\n` +
      (researchText ? `═══ RESEARCH RETRIEVED ═══\n${researchText}\n\n` : "") +
      `Draft ONE concrete offer for Cole's REMOTE coaching business. ${shapeLine}\n\n` +
      `RULES — not style preferences:\n` +
      `- NEVER state a price. Cole has not set remote pricing. If pricing matters to the shape, put what ` +
      `  it depends on under ASSUMPTIONS. A number here would be quoted to a real buyer.\n` +
      `- Never invent a result, statistic or testimonial. If proof would help and none is in the facts, ` +
      `  say what proof would need to exist.\n` +
      `- Cole is a standard-setter, not a guarantee coach: state what is required and why, never "we'll get you X".\n` +
      `- The parent usually buys for a school-age athlete — both must recognise themselves in the promise.\n` +
      `- Nothing may target the athletes at the gym that employs him.\n\n` +
      `Return EXACTLY these labels, nothing else, each on its own line:\n` +
      `NAME: <what it's called>\n` +
      `WHO: <the exact person it's for>\n` +
      `PROMISE: <the outcome in the buyer's language>\n` +
      `SHAPE: <monthly | block | program, and the length if it has one>\n` +
      `FORMAT: <what happens week to week>\n` +
      `PROOF: <how results get demonstrated>\n` +
      `WHY HIM: <the one line no competing coach can copy>\n` +
      `ASSUMPTIONS: <everything you had to guess, including anything pricing depends on>`,
  });

  const text = (res.text ?? "").trim();
  if (!text || engineUnavailableText(text)) {
    return { ok: false, error: "No engine available — refusing to invent an offer. Nothing filed." };
  }
  const parsed = parseOffer(text);
  if (!parsed) {
    return { ok: false, error: "Could not parse a complete offer (needs NAME, WHO and PROMISE). Nothing filed." };
  }

  const row = await prisma.offer.create({
    data: {
      name: parsed.name,
      audience: parsed.audience,
      promise: parsed.promise,
      shape: parsed.shape,
      format: parsed.format,
      proof: parsed.proof,
      edge: parsed.edge,
      assumptions: parsed.assumptions,
      durationWeeks: parsed.durationWeeks,
      // priceCents stays NULL. See rule 2.
      grounding,
      sources: sources.length ? (sources as any) : undefined,
      status: "draft",
    },
  });

  return {
    ok: true,
    offerId: row.id,
    offer: parsed,
    grounding,
    groundingNote:
      grounding === "external"
        ? `Grounded in ${sources.length} retrieved source${sources.length === 1 ? "" : "s"}.`
        : grounding === "internal"
          ? "Grounded in your own corpus — not external research."
          : "NOT RESEARCH-BACKED. This is the model's prior. Treat it as a starting draft, not a finding.",
  };
}

// ── 2. LIFECYCLE — Cole's hand only ──────────────────────────────────

export async function listOffers(status?: string) {
  return prisma.offer.findMany({
    where: status ? { status } : {},
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
  });
}

/** The offers marketing and outreach are allowed to point at. */
export async function activeOffers() {
  return prisma.offer.findMany({ where: { status: "active" }, orderBy: { activatedAt: "desc" } });
}

/**
 * Make an offer live. Cole's action, never a scheduled job's — this is the
 * moment a draft becomes the thing strangers are told he sells.
 *
 * Refuses an unpriced offer: the whole point of activating is that outreach
 * can quote it, and "£?" in a real message is worse than no message.
 */
export async function activateOffer(
  id: string,
  opts: { priceCents?: number } = {}
): Promise<{ ok: boolean; error?: string; offer?: any }> {
  const offer = await prisma.offer.findUnique({ where: { id } });
  if (!offer) return { ok: false, error: `No offer with id ${id}.` };

  const price = opts.priceCents ?? offer.priceCents;
  if (price == null) {
    return {
      ok: false,
      error:
        "This offer has no price, so activating it would point your marketing at something you can't quote. " +
        "Set the price (in cents) and activate again — Aurelius will not pick a number for you.",
    };
  }
  if (!Number.isInteger(price) || price <= 0) {
    return { ok: false, error: "Price must be a positive whole number of cents." };
  }

  const updated = await prisma.offer.update({
    where: { id },
    data: { status: "active", priceCents: price, activatedAt: new Date(), retiredAt: null },
  });
  return { ok: true, offer: updated };
}

export async function retireOffer(id: string): Promise<{ ok: boolean; error?: string }> {
  const offer = await prisma.offer.findUnique({ where: { id } });
  if (!offer) return { ok: false, error: `No offer with id ${id}.` };
  await prisma.offer.update({ where: { id }, data: { status: "retired", retiredAt: new Date() } });
  return { ok: true };
}

// ── 3. WHAT EVERYTHING ELSE READS ────────────────────────────────────

/**
 * The live offer, formatted for prompt injection. Marketing assets and
 * outreach drafts include this so they sell the actual thing.
 *
 * With nothing active it returns an explicit prohibition rather than an empty
 * string — an absent block reads to a model as "no constraint", and the model
 * then invents a plausible offer, which is exactly the failure being prevented.
 */
export async function offerContextBlock(): Promise<string> {
  const offers = await activeOffers().catch(() => []);
  if (offers.length === 0) {
    return (
      "═══ THE OFFER ═══\n" +
      "There is NO ACTIVE OFFER. Do not invent one, do not imply a price, and do not describe a " +
      "package as though it exists. Write to start a conversation, not to sell a thing that has " +
      "no definition yet — and if the copy needs an offer to make sense, say that plainly instead " +
      "of inventing one."
    );
  }
  const lines = ["═══ THE OFFER — sell THIS, exactly as defined ═══"];
  for (const o of offers) {
    lines.push(
      `• ${o.name} (${o.shape}${o.durationWeeks ? `, ${o.durationWeeks} weeks` : ""})` +
        `${o.priceCents != null ? ` — ${formatPrice(o.priceCents, o.currency)}` : ""}`,
      `  For: ${o.audience}`,
      `  Promise: ${o.promise}`,
      ...(o.format ? [`  Week to week: ${o.format}`] : []),
      ...(o.proof ? [`  Proof: ${o.proof}`] : []),
      ...(o.edge ? [`  Edge: ${o.edge}`] : [])
    );
  }
  lines.push("", "Never quote a price other than the one above. Never add a bonus, guarantee or deadline that isn't listed.");
  return lines.join("\n");
}

function formatPrice(cents: number, currency: string): string {
  const sym = currency.toLowerCase() === "usd" ? "$" : `${currency.toUpperCase()} `;
  return `${sym}${(cents / 100).toFixed(2).replace(/\.00$/, "")}`;
}

/**
 * Whether the commercial machine has anything to aim at — used by the risk
 * line and the Business page. Honest by construction: drafts are not offers.
 */
export async function offerReadiness(): Promise<{
  hasActive: boolean;
  activeCount: number;
  draftCount: number;
  headline: string;
  blocker: string | null;
}> {
  const [active, drafts] = await Promise.all([
    prisma.offer.count({ where: { status: "active" } }),
    prisma.offer.count({ where: { status: "draft" } }),
  ]);
  if (active > 0) {
    return {
      hasActive: true,
      activeCount: active,
      draftCount: drafts,
      headline: `${active} live offer${active === 1 ? "" : "s"} — marketing and outreach are pointed at ${active === 1 ? "it" : "them"}.`,
      blocker: null,
    };
  }
  if (drafts > 0) {
    return {
      hasActive: false,
      activeCount: 0,
      draftCount: drafts,
      headline: `${drafts} drafted offer${drafts === 1 ? "" : "s"}, none live. Marketing has nothing to point at until you price one and activate it.`,
      blocker: "price_and_activate",
    };
  }
  return {
    hasActive: false,
    activeCount: 0,
    draftCount: 0,
    headline: "No offer exists. Every angle, email and DM is currently selling an idea with no shape, no length and no price.",
    blocker: "no_offer",
  };
}
