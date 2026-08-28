// aurelius/business/discovery.ts
//
// DISCOVERY-CALL CO-PILOT (NORTH_STAR #5) — the two moments around a sales call
// Cole shouldn't wing:
//   • PREP — pull everything known about the lead into a one-glance call sheet:
//     who they are, what they came in wanting, the offer to present, the
//     questions that actually qualify, the objections to expect.
//   • FOLLOW-UP — draft the message after the call while it's warm, from the
//     lead plus whatever Cole jotted down.
//
// Prep is a READ (nothing written). Follow-up is INWARD (a draft Cole reads and
// sends — never auto-sent). Both refuse honestly when the engine is down rather
// than filing an error as a call sheet or a message to a real person (hard rule
// 3). Leads are business prospects, so the gym boundary isn't in play here — but
// nothing fabricates a result Cole hasn't produced.

import { prisma } from "../core/db/prisma.ts";
import { runLLM } from "../llm/runLLM.ts";
import { engineUnavailableText } from "../llm/nonAnswer.ts";

async function leadContext(leadId: string) {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { id: true, name: true, sport: true, notes: true, source: true, email: true, status: true },
  });
  if (!lead) return null;
  const [offerBlock, brandVoice, bizBlock] = await Promise.all([
    import("./offers.ts").then((m) => m.offerContextBlock()).catch(() => ""),
    import("./brand.ts").then((m) => m.brandVoiceBlock()).catch(() => ""),
    import("./positioning.ts").then((m) => m.businessContextBlock()).catch(() => ""),
  ]);
  return { lead, offerBlock, brandVoice, bizBlock };
}

/** A one-glance prep sheet for a discovery call. Read-only. */
export async function discoveryPrep(leadId: string): Promise<{ ok: boolean; sheet?: string; error?: string }> {
  const ctx = await leadContext(leadId);
  if (!ctx) return { ok: false, error: `No lead with id ${leadId}.` };
  const { lead } = ctx;

  const res = await runLLM({
    taskType: "chat",
    operators: { primary: "business", secondaries: ["strategy"] },
    noReuse: true,
    omitToolCatalog: true,
    input:
      `${ctx.bizBlock}\n\n${ctx.offerBlock}\n\n` +
      `Build a discovery-call prep sheet for Cole's call with this lead.\n` +
      `WHO: ${lead.name}${lead.sport ? ` · ${lead.sport}` : ""}\n` +
      (lead.notes ? `WHAT THEY SAID / CONTEXT: ${lead.notes}\n` : "") +
      `\nGive, tight and scannable:\n` +
      `1. THE PICTURE — what you can infer about their goal and situation (mark inferences as inferences).\n` +
      `2. QUALIFYING QUESTIONS — 3-5 that reveal whether Cole's offer actually fits (and whether they can commit).\n` +
      `3. THE OFFER TO PRESENT — which shape fits, framed to their goal; if no offer/price is set, say what to hold back.\n` +
      `4. LIKELY OBJECTIONS — 2-3 and an honest response to each (standard-setter, not guarantee coach).\n` +
      `RULES: never invent a result or a stat. Short bullets. This is a prep sheet, not a script.`,
  });
  const sheet = (res.text ?? "").trim();
  if (!sheet || sheet.length < 60 || engineUnavailableText(sheet)) {
    return { ok: false, error: "No engine available — refusing to hand you an error as a call sheet. Nothing filed." };
  }
  return { ok: true, sheet };
}

/** Draft the post-call follow-up, from the lead plus Cole's call notes. INWARD. */
export async function discoveryFollowup(leadId: string, notes?: string): Promise<{ ok: boolean; body?: string; error?: string }> {
  const ctx = await leadContext(leadId);
  if (!ctx) return { ok: false, error: `No lead with id ${leadId}.` };
  const { lead } = ctx;

  const res = await runLLM({
    taskType: "chat",
    operators: { primary: "business", secondaries: ["content"] },
    noReuse: true,
    omitToolCatalog: true,
    input:
      `${ctx.bizBlock}\n\n${ctx.offerBlock}\n\n${ctx.brandVoice}\n\n` +
      `Write Cole's follow-up message after a discovery call with ${lead.name}.\n` +
      (lead.notes ? `WHAT HE KNEW GOING IN: ${lead.notes}\n` : "") +
      (notes && notes.trim() ? `WHAT HAPPENED ON THE CALL (Cole's notes): ${notes.trim()}\n` : `(No call notes given — keep it a warm, general "great talking" recap with one clear next step.)\n`) +
      `\nRULES: reference the actual conversation if notes are given; one clear next step (the offer, a start date, or a simple yes/no); under 130 words; standard-setter not guarantee coach; no fake urgency, no emoji spam. Return ONLY the message body.`,
  });
  const body = (res.text ?? "").trim();
  if (!body || body.length < 30 || engineUnavailableText(body)) {
    return { ok: false, error: "No engine available — refusing to draft an error at a real person. Nothing filed." };
  }
  return { ok: true, body };
}
