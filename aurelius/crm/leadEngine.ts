// aurelius/crm/leadEngine.ts
//
// LEAD ACQUISITION — the only part of this system that can produce a dollar.
//
// The 2026-08-06 council was unanimous: Lead → Client → Engagement → Invoice →
// Payment is built and proven, and step 1 does not exist in code. Every caller
// of `addLead` was Cole typing. `LEAD_SOURCES` offered "instagram" and
// "website" as values with nothing that could ever produce them. A beautifully
// instrumented cash register in a shop with no door.
//
// This is the door. Three ways in, in the order they can actually work for a
// coach with no audience:
//
//   1. THE WARM LIST — the only channel that works at zero followers. Cole
//      names people he already knows; Aurelius researches each against his
//      offer, drafts a personal message into Gmail DRAFTS, and tracks the
//      follow-up. This needs no send scope, no Meta token, no media host, and
//      no funnel. It is the shortest path from this repo to a first client.
//   2. INBOUND CAPTURE — a public intake endpoint and inbound-email parsing,
//      so a lead can arrive without Cole typing it.
//   3. THE FOLLOW-UP SPINE — a warm lead goes cold in days. Nothing here is
//      worth building if the second message never gets sent.
//
// AUTONOMY. Drafting is INWARD (`outreach.draft`) — reversible, it only ever
// writes a Gmail draft. SENDING is `outreach.send`, outward, always Cole's
// confirm, non-grantable. That split is the whole safety story: Aurelius can
// do the work of prospecting without ever contacting anyone on its own.
//
// PEOPLE, NOT RECORDS. These are real people, often minors and their parents.
// Nothing here fabricates a claim about them, nothing writes a message that
// asserts a result Cole hasn't produced, and every draft is his to read before
// it goes anywhere.

import { prisma } from "../core/db/prisma.ts";
import { runLLM } from "../llm/runLLM.ts";
import { engineUnavailableText } from "../llm/nonAnswer.ts";
import { executeAction } from "../autonomy/executor.ts";
import { addLead, LEAD_SOURCES } from "./service.ts";

export const OUTREACH_DRAFT_CLASS = "outreach.draft";

// ── 1. THE WARM LIST ─────────────────────────────────────────────────

export type WarmListEntry = {
  name: string;
  email?: string;
  phone?: string;
  /** How Cole knows them — the single most useful thing for personalising. */
  context?: string;
  sport?: string;
  relationship?: string; // "former athlete" | "parent" | "coach" | "friend"
};

/**
 * Import the people Cole already knows. Deduped on email, then on exact name,
 * so pasting the same list twice doesn't create twenty ghosts.
 */
export async function importWarmList(
  entries: WarmListEntry[],
  opts: { source?: string } = {}
): Promise<{ created: number; skipped: number; leads: { id: string; name: string }[] }> {
  const source = opts.source && (LEAD_SOURCES as readonly string[]).includes(opts.source) ? opts.source : "word_of_mouth";
  const leads: { id: string; name: string }[] = [];
  let skipped = 0;

  for (const raw of entries) {
    const name = (raw.name ?? "").trim();
    if (!name) { skipped++; continue; }
    const email = raw.email?.trim() || null;

    const existing = await prisma.lead.findFirst({
      where: email ? { OR: [{ email }, { name }] } : { name },
      select: { id: true },
    });
    if (existing) { skipped++; continue; }

    const lead = await addLead({
      name,
      email: email ?? undefined,
      phone: raw.phone,
      sport: raw.sport,
      source,
      // NOT referredBy. `relationship` is how COLE knows them ("former athlete",
      // "parent"), not who SENT them — and a warm-list lead has no referrer, Cole
      // knows them directly. Stuffing it into referredBy corrupted referral
      // attribution (and draftOutreach then read it back as the relationship,
      // making the bug self-consistent and invisible). Keep it in the notes,
      // where the personalisation prompt already looks.
      notes: [raw.relationship ? `Relationship: ${raw.relationship}` : null, raw.context]
        .filter(Boolean)
        .join("\n") || undefined,
      // Every imported lead gets a due date immediately. A warm list with no
      // next action is a list, not a pipeline — and the whole failure mode
      // here is good intentions that never get a second contact.
      nextAction: "First message",
      nextActionAt: new Date(),
    });
    leads.push({ id: lead.id, name: lead.name });
  }
  return { created: leads.length, skipped, leads };
}

// ── 2. DRAFTING ──────────────────────────────────────────────────────

/**
 * Draft ONE personal outreach message for a lead.
 *
 * Grounded in Cole's actual business facts (so it can't invent an offer) and
 * in what he said about this person. Guarded by `engineUnavailableText`: a
 * model error must never become a message to a real human being — the same
 * defect that had to be fixed in inbox triage, and far worse here, because
 * this one is addressed to someone who might have become a client.
 */
export async function draftOutreach(
  leadId: string,
  // origin distinguishes WHO asked for this draft. The reactive lead-catch
  // passes "inbound" so its drafts carry a marker in the sourceId — that lets
  // the reactor's daily cap count ONLY reactive drafts, not the scheduled
  // sweep's or a manual "draft a reply". Default (undefined) is byte-identical
  // to the historic behaviour, so the sweep/manual/smoke callers are unchanged.
  opts: { origin?: "inbound" } = {}
): Promise<{
  ok: boolean;
  gated?: boolean;
  bridgeSignalId?: string;
  // Present only when the draft actually got written (not gated) — the reactive
  // one-tap send stages off these.
  draftId?: string;
  to?: string;
  error?: string;
}> {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) return { ok: false, error: `No lead with id ${leadId}.` };
  if (["won", "lost"].includes(lead.status)) {
    return { ok: false, error: `${lead.name} is already ${lead.status} — not drafting.` };
  }

  const { businessContextBlock } = await import("../business/positioning.ts");
  const { offerContextBlock } = await import("../business/offers.ts");
  const { brandVoiceBlock } = await import("../business/brand.ts");
  // The message must describe the offer Cole actually sells — or, when none is
  // live, say nothing about packages or price rather than improvising one. The
  // voice block keeps a 1:1 message in Cole's cadence, not a generic coach's.
  const context = `${await businessContextBlock()}\n\n${await offerContextBlock()}\n\n${brandVoiceBlock()}`;

  const priorTouches = await prisma.bridgeSignal.count({
    where: { sourceType: "outreach_draft", sourceId: { startsWith: `outreach:${lead.id}` } },
  });
  const isFollowUp = priorTouches > 0 || !!lead.lastContactAt;

  return executeAction({
    actionClass: OUTREACH_DRAFT_CLASS,
    sourceType: "outreach_draft",
    // Touch-numbered so a follow-up isn't deduped against the first message.
    // The trailing ":auto" on reactive drafts still startsWith `outreach:${id}`
    // (so touch-counting above is unaffected) but is countable on its own, so
    // the reactor caps its budget without starving the scheduled sweep.
    sourceId: `outreach:${lead.id}:${priorTouches + 1}${opts.origin === "inbound" ? ":auto" : ""}`,
    prepare: async () => {
      const res = await runLLM({
        taskType: "chat",
        operators: { primary: "business", secondaries: ["content"] },
        noReuse: true,
        omitToolCatalog: true,
        input:
          `${context}\n\n` +
          `Write ${isFollowUp ? "a SHORT follow-up" : "a first message"} from Cole to someone he already knows. ` +
          `This is a real person, not a marketing segment.\n\n` +
          `WHO: ${lead.name}\n` +
          (lead.sport ? `SPORT: ${lead.sport}\n` : "") +
          (lead.referredBy ? `REFERRED BY: ${lead.referredBy} (mention the connection naturally)\n` : "") +
          (lead.notes ? `WHAT COLE SAID ABOUT THEM: ${lead.notes}\n` : "") +
          `\nRULES — these are not style preferences:\n` +
          `- Never claim a result, statistic, or outcome that isn't in the confirmed facts above. If you want to ` +
          `  reference proof and none is stated, say nothing rather than inventing one.\n` +
          `- Cole is a standard-setter, not a guarantee coach. State what's required, never "we'll get you X".\n` +
          `- If the athlete is school-age, the parent is usually the buyer — write so both recognise it.\n` +
          `- No pitch-deck voice, no "hope this finds you well", no fake urgency, no emoji.\n` +
          `- Under 120 words. One clear ask, and make the ask easy to say no to.\n` +
          (isFollowUp
            ? `- This is a FOLLOW-UP. Acknowledge that lightly, add one new thing, do not repeat the first pitch.\n`
            : "") +
          `\nReturn ONLY the message body — no subject line, no signature block.`,
      });
      const body = (res.text ?? "").trim();

      // A model error addressed to a prospective client is worse than silence.
      if (!body || body.length < 30 || engineUnavailableText(body)) {
        throw new Error(
          `No usable outreach draft for ${lead.name} — the model returned an error or empty text. Skipped rather than sent to a real person.`
        );
      }

      return {
        title: `Outreach drafted — ${lead.name}${isFollowUp ? " (follow-up)" : ""}`,
        body:
          `**To:** ${lead.name}${lead.email ? ` <${lead.email}>` : " (no email on file)"}\n` +
          (lead.notes ? `**Context:** ${lead.notes}\n` : "") +
          `\n**Draft:**\n\n${body}\n\n` +
          `_Confirm files this in your Gmail drafts. It does not send — sending is outward and stays your call._`,
        domain: "business",
        payload: { leadId: lead.id, to: lead.email, name: lead.name, body, touch: priorTouches + 1 },
      };
    },
  }).then(
    (exec) => ({
      ok: true,
      gated: !exec.finalized,
      bridgeSignalId: exec.bridgeSignalId,
      // Present only when the draft actually got written (granted/acted, not
      // gated) — the reactive one-tap send stages off these.
      draftId: exec.result?.draftId as string | undefined,
      to: exec.result?.to as string | undefined,
    }),
    (err) => ({ ok: false, error: err?.message ?? String(err) })
  );
}

/**
 * Commit a drafted outreach: file it in Gmail drafts and advance the lead.
 *
 * INWARD by construction — `draftReply` writes a draft, it does not send. The
 * lead's follow-up date moves out so the pipeline keeps a next action on every
 * open lead, which is the discipline the whole engine exists to enforce.
 */
export async function finalizeOutreachDraft(payload: any): Promise<{ draftId?: string; leadId: string; to?: string }> {
  const { leadId, to, body, name } = payload ?? {};
  if (!leadId) throw new Error("outreach draft payload missing leadId");

  // NO EMAIL, NO CONTACT. The draft was guarded on `if (to)` and the "contacted"
  // write below was not, so a warm-list entry Cole had only a phone number for
  // was marked contacted, stamped with lastContactAt, and rotated four days
  // forward — having been contacted by nobody. It then aged out of his
  // attention permanently, which is the worst possible outcome for the one
  // channel that works at zero audience.
  //
  // Throwing is the honest response: no draft was written, so no work happened,
  // and the executor must record a failure rather than a phantom success.
  if (!to) {
    throw new Error(
      `${name ?? "That lead"} has no email on file — I can't draft anything. ` +
        `Add an email, or reach them yourself and log it.`
    );
  }

  const { draftReply } = await import("../gmail/engine.ts");
  const res: any = await draftReply({
    to,
    subject: `Quick one, ${String(name ?? "").split(" ")[0] || "hey"}`,
    // First contact. Without this the subject ships as "Re: Quick one, Sarah"
    // to someone who has never emailed him.
    isReply: false,
    body,
  });
  const draftId = res?.id ?? res?.draftId;
  const threadId = res?.threadId as string | undefined;

  const FOLLOW_UP_DAYS = 4; // a warm lead goes cold in about a week
  await prisma.lead.update({
    where: { id: leadId },
    data: {
      status: "contacted",
      lastContactAt: new Date(),
      nextAction: "Follow up if no reply",
      nextActionAt: new Date(Date.now() + FOLLOW_UP_DAYS * 86400_000),
      // Persist the thread so an inbound reply can be matched back to this lead
      // and flip it to "conversing" — without it, a reply is invisible.
      ...(threadId ? { outreachThreadId: threadId } : {}),
      // Persist the draft id so Cole can one-tap "send that to <name>" and the
      // gated outreach.send delivers the exact reviewed draft.
      ...(draftId ? { outreachDraftId: draftId } : {}),
    },
  });
  return { draftId, leadId, to };
}

// ── 3. THE SWEEP ─────────────────────────────────────────────────────

/**
 * Draft what's due. Scheduled, bounded, and deliberately small.
 *
 * MAX_PER_RUN is 3, not 20. The council's sharpest warning was that a funded
 * key multiplies generation without touching Cole's review capacity — twenty
 * drafts he never reads is not twenty leads worked, it is a muted bridge. Three
 * a day is twenty-one a week, which is more outreach than he has ever sent, and
 * each one arrives with room to be read.
 */
const MAX_PER_RUN = 3;

export async function runOutreachSweep(opts: { max?: number } = {}): Promise<{
  due: number;
  drafted: number;
  gated: number;
  failed: number;
  skipped: string[];
}> {
  const max = Math.min(opts.max ?? MAX_PER_RUN, 10);
  const openAndDue = {
    status: { notIn: ["won", "lost", "dormant"] },
    nextActionAt: { not: null, lte: new Date() },
  };

  // Only leads this sweep can actually draft for. Without the email filter the
  // sweep spends its three slots a day on people it will throw on, and the
  // leads it COULD reach never come up — the three-slot cap makes an
  // undraftable lead not merely wasteful but blocking.
  const due = await prisma.lead.findMany({
    where: { ...openAndDue, email: { not: null } },
    orderBy: { nextActionAt: "asc" },
    take: max,
  });

  // But say so, once. Silently skipping them is how the warm list quietly
  // shrinks to whoever happened to have an email address. Deduped by
  // surfaceSignal on (sourceType, sourceId) within the day.
  const unreachable = await prisma.lead.count({ where: { ...openAndDue, email: null } });
  if (unreachable > 0) {
    const { surfaceSignal } = await import("../core/bridge.ts");
    await surfaceSignal({
      kind: "gap_alert",
      domain: "business",
      sourceType: "outreach_unreachable",
      sourceId: "warm_list:no_email",
      severity: "notice",
      title: `${unreachable} warm lead${unreachable === 1 ? "" : "s"} I can't reach`,
      body:
        `${unreachable} ${unreachable === 1 ? "person is" : "people are"} due for a follow-up with no email on file, ` +
        `so I can't draft anything for ${unreachable === 1 ? "them" : "them"}. Add an email and I'll pick ${unreachable === 1 ? "them" : "them"} up ` +
        `tomorrow — or message ${unreachable === 1 ? "them" : "them"} yourself and mark it done. I'm not counting ${unreachable === 1 ? "them" : "them"} as contacted.`,
    }).catch(() => {});
  }

  const result = { due: due.length, drafted: 0, gated: 0, failed: 0, skipped: [] as string[] };
  for (const lead of due) {
    const res = await draftOutreach(lead.id);
    if (!res.ok) {
      result.failed++;
      result.skipped.push(`${lead.name}: ${res.error}`);
      continue;
    }
    if (res.gated) result.gated++;
    else result.drafted++;
  }
  console.log(
    `[leadEngine] due ${result.due} · drafted ${result.drafted} · proposed ${result.gated} · failed ${result.failed}`
  );
  return result;
}

// ── 4. INBOUND CAPTURE ───────────────────────────────────────────────

/**
 * A lead that arrived on its own. This is what makes "instagram" and "website"
 * real values rather than enum decoration.
 *
 * UNTRUSTED INPUT — this is reachable from a public form. Everything is length-
 * capped and directive-defused before it can reach a prompt, and it creates a
 * Lead and nothing else: no autonomous reply, no outward action.
 */
/**
 * Resolve a short public `ref` to the angle that earned the lead.
 *
 * ATTRIBUTION IS THE POINT OF THE RESULTS LOOP. `Lead.angleId` existed but
 * inbound capture never set it, so the only way an angle got credit was Cole
 * remembering which post produced which stranger — i.e. never. A ref is the
 * first 8 characters of a draft id or an angle id, short enough to live in a
 * link. A draft resolves to the angle it was written from, so credit lands on
 * the idea rather than the individual post.
 *
 * Ambiguous or unknown refs resolve to null and the lead is still captured —
 * losing a lead over a bad tracking code would be the worst possible trade.
 */
export async function resolveRef(ref: string | undefined): Promise<string | null> {
  const clean = (ref ?? "").trim().replace(/[^a-zA-Z0-9]/g, "").slice(0, 30);
  if (clean.length < 6) return null;
  const drafts = await prisma.contentDraft
    .findMany({ where: { id: { startsWith: clean } }, select: { angleId: true }, take: 2 })
    .catch(() => []);
  if (drafts.length === 1) return drafts[0]!.angleId;
  const angles = await prisma.marketingAngle
    .findMany({ where: { id: { startsWith: clean } }, select: { id: true }, take: 2 })
    .catch(() => []);
  if (angles.length === 1) return angles[0]!.id;
  return null;
}

/**
 * The full attribution context a ref carries. A minted TrackLink (the real
 * emitter) is an EXACT code match and carries its channel + angle; the older
 * draft-id/angle-id prefix links still in the wild fall through to resolveRef,
 * so nothing that was ever posted stops attributing.
 */
export async function resolveAttribution(ref: string | undefined): Promise<{
  angleId: string | null;
  trackLinkId: string | null;
  refCode: string | null;
  channel: string | null;
}> {
  const clean = (ref ?? "").trim().replace(/[^a-zA-Z0-9]/g, "").slice(0, 30);
  if (clean.length < 5) return { angleId: null, trackLinkId: null, refCode: null, channel: null };
  const link = await prisma.trackLink.findUnique({ where: { code: clean } }).catch(() => null);
  if (link) return { angleId: link.angleId, trackLinkId: link.id, refCode: link.code, channel: link.channel };
  const angleId = await resolveRef(ref);
  return { angleId, trackLinkId: null, refCode: angleId ? clean : null, channel: null };
}

export async function captureInboundLead(input: {
  name: string;
  email?: string;
  phone?: string;
  sport?: string;
  message?: string;
  source?: string;
  /** Short code from the link they came through — see resolveRef. */
  ref?: string;
  /** Who sent them, when known (a referral). If it matches an active client,
   *  the referral loop is credited and closed. */
  referredBy?: string;
}): Promise<{ ok: boolean; leadId?: string; error?: string }> {
  const { defuseDirectives } = await import("../llm/directiveParser.ts");
  const clean = (s: string | undefined, max: number) =>
    s ? defuseDirectives(String(s).slice(0, max)).trim() : undefined;

  const name = clean(input.name, 120);
  if (!name) return { ok: false, error: "A lead needs a name." };

  const email = clean(input.email, 200);
  // Which idea AND which link earned them. Resolved before the dedup branch so a
  // second submission through a different post records the newer attribution.
  const attr = await resolveAttribution(input.ref).catch(() => ({
    angleId: null as string | null,
    trackLinkId: null as string | null,
    refCode: null as string | null,
    channel: null as string | null,
  }));
  const { recordAttribution } = await import("./trackLinks.ts");
  // A tracked link names its own channel; otherwise honour what the form said,
  // then fall back to "website".
  const channel = attr.channel
    ?? ((LEAD_SOURCES as readonly string[]).includes(input.source ?? "") ? input.source! : "website");

  // Don't create a duplicate when someone submits the form twice. Email is the
  // strong key; without it, fall back to phone, then to same-name-within-6h —
  // otherwise a contact-less POST mints a fresh lead EVERY time, an abuse
  // amplifier (unlimited leads + unlimited phone pushes) the council flagged.
  const phoneDigits = (clean(input.phone, 40) ?? "").replace(/[^0-9]/g, "");
  let existing = email ? await prisma.lead.findFirst({ where: { email }, select: { id: true } }) : null;
  if (!existing && phoneDigits.length >= 7) {
    existing = await prisma.lead.findFirst({ where: { phone: { contains: phoneDigits.slice(-10) } }, select: { id: true } });
  }
  if (!existing && !email && phoneDigits.length < 7) {
    const since = new Date(Date.now() - 6 * 3600_000);
    existing = await prisma.lead.findFirst({
      where: { name: { equals: name, mode: "insensitive" }, createdAt: { gte: since } },
      select: { id: true },
    });
  }
  if (existing) {
    await prisma.lead.update({
      where: { id: existing.id },
      data: {
        nextAction: "They wrote in again — reply",
        nextActionAt: new Date(),
        ...(attr.angleId ? { angleId: attr.angleId } : {}),
        ...(attr.refCode ? { refCode: attr.refCode } : {}),
        ...(attr.trackLinkId ? { trackLinkId: attr.trackLinkId } : {}),
      },
    });
    await recordAttribution({
      kind: "intake",
      channel,
      refCode: attr.refCode,
      trackLinkId: attr.trackLinkId,
      angleId: attr.angleId,
      leadId: existing.id,
      metadata: { repeat: true },
    });
    return { ok: true, leadId: existing.id };
  }

  const referredBy = clean(input.referredBy, 120);
  const lead = await addLead({
    name,
    email,
    phone: clean(input.phone, 40),
    sport: clean(input.sport, 60),
    source: referredBy ? "referral" : channel,
    referredBy,
    notes: clean(input.message, 2000),
    nextAction: "Reply — they reached out first",
    nextActionAt: new Date(),
  });
  // Credit the referral loop when the referrer names an active client — the
  // scoped referredBy (not a relationship label; the 1.5 fix keeps that clean).
  if (referredBy) {
    await import("./retention.ts").then((m) => m.creditReferral(lead.id, referredBy)).catch(() => {});
  }
  // The chain link/angle → lead → client → payment only closes if this hop
  // happens. Best-effort: a tracking write must never cost the lead itself.
  if (attr.angleId || attr.refCode || attr.trackLinkId) {
    await prisma.lead
      .update({
        where: { id: lead.id },
        data: {
          ...(attr.angleId ? { angleId: attr.angleId } : {}),
          ...(attr.refCode ? { refCode: attr.refCode } : {}),
          ...(attr.trackLinkId ? { trackLinkId: attr.trackLinkId } : {}),
        },
      })
      .catch(() => {});
  }
  // The intake touch — the first attributable event that has a lead attached.
  await recordAttribution({
    kind: "intake",
    channel,
    refCode: attr.refCode,
    trackLinkId: attr.trackLinkId,
    angleId: attr.angleId,
    leadId: lead.id,
  });

  // An inbound lead is the rarest event in this business. It is a decision,
  // it is time-critical, and it should reach the phone immediately — the FIRST
  // few in a day. But a flood (abuse, or a genuinely viral day) must not mute the
  // channel every outward confirm rides on (council R2), so past a daily cap the
  // lead still files to the Bridge (visible, badge-counted) but doesn't buzz.
  const INBOUND_PUSH_CAP = 5;
  try {
    let quiet = false;
    try {
      const dayStart = new Date();
      dayStart.setHours(0, 0, 0, 0);
      const pushedToday = await prisma.bridgeSignal.count({
        where: { sourceType: "inbound_lead", pushedAt: { not: null, gte: dayStart } },
      });
      quiet = pushedToday >= INBOUND_PUSH_CAP;
    } catch {
      /* counting failed — default to the loud path; a real lead is worth the buzz */
    }
    const { surfaceSignal } = await import("../core/bridge.ts");
    // The CTA depends on whether Aurelius can act: with an email, the lead.inbound
    // reactor is about to draft the reply (one-tap flagship); without one, there's
    // nothing to draft, so the honest ask is for Cole to reach them his way.
    const cta = lead.email
      ? `They came to you. I'm drafting your reply now — it'll land here for a one-tap review, and sending stays your call. ` +
        `Response time is the whole conversion lever at this stage.`
      : `They came to you. Reply today — response time is the whole conversion lever at this stage. ` +
        `No email on file, so reach them your way and mark it done (I can't draft without one).`;
    await surfaceSignal({
      kind: "opportunity",
      domain: "business",
      sourceType: "inbound_lead",
      sourceId: `lead:${lead.id}`,
      severity: "attention",
      quiet,
      title: `New inbound lead — ${lead.name}`,
      body:
        `${lead.name}${lead.email ? ` (${lead.email})` : ""} reached out${lead.sport ? ` about ${lead.sport}` : ""}.\n\n` +
        (lead.notes ? `> ${lead.notes.slice(0, 500)}\n\n` : "") +
        cta,
    });
  } catch {
    /* the lead is captured either way */
  }

  // Announce the fact on the bus — ONCE, decoupled. The lead.inbound reactor
  // (autonomy/reactors.ts) drafts the reply so it's waiting for Cole; future
  // reactors (nurture cadence, Day-Model refresh) attach there without this
  // function learning about them. Fire-and-forget: an inbound HTTP intake must
  // not block on a reactor's LLM call, and no handler can throw out of emit.
  try {
    const { emit } = await import("../core/events.ts");
    void emit({
      type: "lead.inbound",
      leadId: lead.id,
      name: lead.name,
      source: referredBy ? "referral" : channel,
      hasEmail: !!email,
    });
  } catch {
    /* the lead is captured and surfaced either way */
  }
  return { ok: true, leadId: lead.id };
}
