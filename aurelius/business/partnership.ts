// aurelius/business/partnership.ts
//
// PARTNERSHIP ACQUISITION — finding the next partner is a TASK, not a channel.
//
// Cole has NO current partnership (BreatheFire/CAL10 was a prior collab). So a
// brand partnership is a target the demand engine has to find and land, and
// BreatheFire is only a TEMPLATE for the kind of non-competing partner to
// pursue: apparel, gear, or a complementary service whose audience overlaps his
// athletes without competing for his coaching.
//
// This researches candidate partners (config-gated on a research key) and drafts
// a personal intro — INWARD, a Gmail-draft-shaped message Cole reviews and sends
// himself; each carries its own tracked ref so a partnership's traffic is
// attributable. Nothing here contacts anyone.

import { runLLM } from "../llm/runLLM.ts";
import { engineUnavailableText } from "../llm/nonAnswer.ts";

/**
 * Suggest the TYPES of partner worth pursuing and, when research is available,
 * named candidates. Grounded in Cole's real positioning (his audience, his
 * non-compete boundary), never a generic influencer list.
 */
export async function researchPartners(): Promise<{ ok: boolean; suggestions: string; grounding: string }> {
  const { businessContextBlock, businessResearchContext } = await import("./positioning.ts");
  const context = await businessContextBlock();

  let researchText = "";
  let grounding = "none";
  try {
    const { runResearch } = await import("../research/researchEngine.ts");
    const res: any = await runResearch({
      query:
        `Non-competing brand partners for an independent athletic performance coach: apparel, gear, recovery, ` +
        `or complementary services whose audience is high-school and college athletes and their parents. ` +
        `Context: ${await businessResearchContext()}`,
      operator: "business",
      depth: "deep",
      subject: "brand partnership candidates for an athletic coach",
      kind: "topic",
    });
    const body = [res?.synthesis, ...(res?.insights ?? [])].filter(Boolean).join("\n\n");
    if (body && !engineUnavailableText(body)) {
      researchText = body.slice(0, 5000);
      grounding = res?.grounding ?? "internal";
    }
  } catch {
    /* research down — proceed on model priors, labelled */
  }

  const res = await runLLM({
    taskType: "chat",
    operators: { primary: "business", secondaries: ["content"] },
    noReuse: true,
    omitToolCatalog: true,
    input:
      `${context}\n\n` +
      (researchText ? `═══ RESEARCH ═══\n${researchText}\n\n` : "") +
      `List 4–6 SPECIFIC kinds of brand partner Cole should pursue (apparel, gear, recovery, complementary ` +
      `service), and for each: why the audiences overlap, and what a fair first collaboration looks like ` +
      `(a code, a co-branded piece, a referral). Non-competing only — nothing that sells coaching. ` +
      `BreatheFire (apparel, code CAL10) is the template, not a current partner.`,
  });
  const text = (res.text ?? "").trim();
  if (!text || engineUnavailableText(text)) {
    return { ok: false, suggestions: "No engine available — refusing to invent partner names. Nothing filed.", grounding: "none" };
  }
  return { ok: true, suggestions: text, grounding };
}

/**
 * Draft a personal intro to a named partner (INWARD). Mints a partnership-tagged
 * tracked link so any traffic the partnership drives is attributable, and
 * returns the draft for Cole to send himself.
 */
export async function draftPartnerIntro(input: { name: string; handle?: string; angle?: string }): Promise<{
  ok: boolean;
  error?: string;
  body?: string;
  refCode?: string;
  refUrl?: string;
}> {
  const name = (input.name ?? "").trim();
  if (!name) return { ok: false, error: "Which partner?" };

  const { businessContextBlock } = await import("./positioning.ts");
  const { brandVoiceBlock } = await import("./brand.ts");

  const res = await runLLM({
    taskType: "chat",
    operators: { primary: "business", secondaries: ["content"] },
    noReuse: true,
    omitToolCatalog: true,
    input:
      `${await businessContextBlock()}\n\n${brandVoiceBlock()}\n\n` +
      `Write a short, direct intro DM/email from Cole to ${name}${input.handle ? ` (${input.handle})` : ""} proposing a ` +
      `non-competing partnership (apparel/gear/complementary). ${input.angle ? `Angle: ${input.angle}. ` : ""}` +
      `RULES: peer-to-peer, not fan mail; name the specific audience overlap; propose ONE concrete first step ` +
      `(a code, a co-branded piece); under 120 words; no hype, no emoji spam. Return ONLY the message.`,
  });
  const body = (res.text ?? "").trim();
  if (!body || body.length < 30 || engineUnavailableText(body)) {
    return { ok: false, error: "No engine available — refusing to draft an intro to a real person. Nothing filed." };
  }

  // Per-partner tracked ref, so a landed partnership's traffic is attributable.
  const { mintTrackLink, trackLinkUrl } = await import("../crm/trackLinks.ts");
  const link = await mintTrackLink({ channel: "partnership", label: `Partner — ${name}` });
  const u = trackLinkUrl(link.code);
  return { ok: true, body, refCode: link.code, refUrl: u.url };
}
