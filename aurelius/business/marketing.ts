// aurelius/business/marketing.ts
//
// THE MARKETING ENGINE — evidence, never a confident guess.
//
// Cole's own framing, and it is the design constraint: marketing is the thing
// he lacks most, which means he cannot tell a good marketing guess from a bad
// one. A fluent model improvising a clever post is therefore the WORST possible
// shape for this feature — it produces something he has no way to audit, and
// he'd act on it.
//
// So three rules hold everywhere in this file:
//
//   1. NOTHING IS ASSERTED WITHOUT ITS GROUNDING. Every angle carries where it
//      came from — external sources retrieved, his own corpus, or (honestly
//      labelled) model priors. `grounding: "none"` is printed, not hidden. He
//      can then weigh it himself, which is the only thing that makes this
//      better than him guessing.
//   2. HIS RESULTS OUTRANK THE RESEARCH. Generic research about "what parents
//      of varsity athletes respond to" gives what every competing coach already
//      knows — a fine first bet and a terrible final answer. The moment an
//      angle has been used and replied to (or ignored), that becomes the
//      evidence, and `anglePerformance` reports it plainly.
//   3. RESEARCH MUST NOT BECOME PROCRASTINATION. He has zero clients. This
//      reaches a defensible answer and stops; it never gates shipping on more
//      reading. A researched message sent Thursday beats a perfect one never.
//
// Everything here is INWARD. It proposes angles and drafts copy. Publishing is
// `content.publish` and sending is `outreach.send` — both outward, both Cole's
// confirm, neither reachable from this file.

import { prisma } from "../core/db/prisma.ts";
import { runLLM } from "../llm/runLLM.ts";
import { engineUnavailableText } from "../llm/nonAnswer.ts";
import type { ResearchResult } from "../research/researchTypes.ts";

export const MARKETING_FORMATS = ["email", "instagram_post", "instagram_carousel", "dm", "landing_section"] as const;
export type MarketingFormat = (typeof MARKETING_FORMATS)[number];

/** How much to trust a claim, in one word, printed wherever the claim is. */
export type Grounding = "external" | "internal" | "none";

/**
 * PURE — translate a research run's own verdict into the label Cole sees.
 *
 * This exists because the translation was written twice, character-identically,
 * in this file and in offers.ts, and was wrong in both:
 *
 *     grounding = res?.grounding === "external" ? "external" : "internal"
 *
 * `runResearch` returns ONLY "external" | "model-only" (research/researchTypes.ts:59).
 * There is no "internal" in its vocabulary. So a pure model prior — every run on
 * an Anthropic-only key, with no TAVILY_API_KEY or GEMINI_API_KEY for web search —
 * came back labelled "internal", which prints as "Grounded in your own corpus and
 * prior results" and renders on the Business page in gold as "from your own data".
 *
 * That is the most trustworthy label available, applied to the least grounded case,
 * in the one file whose entire stated purpose is that Cole cannot audit marketing
 * advice and so must be told how much to trust it. It inverted the guarantee.
 *
 * The rule now: "internal" means COLE'S OWN RESULTS and nothing else. A model
 * prior is "none" and says so. An "external" run that retrieved zero source URLs
 * is also "none" — a claim of external grounding you cannot show a link for is
 * not evidence, it is a citation to nowhere.
 */
export function groundingFromResearch(
  researchVerdict: string | undefined,
  sourceCount: number,
  hasOwnResults: boolean
): Grounding {
  if (researchVerdict === "external" && sourceCount > 0) return "external";
  // NOTE: `sourceCount` must be the count of MARKET sources — see
  // marketSourceCount below. Passing the raw source count re-opens the hole
  // this function was written to close, one tier down.
  // Cole's own performance data is genuinely internal evidence — but only when
  // it exists. With zero sends it must not stand in for research.
  if (hasOwnResults) return "internal";
  return "none";
}

/**
 * Sources that are actually evidence about a MARKET.
 *
 * The first fix mapped "model-only" to "none" and stopped there, which moved
 * the lie one tier down instead of closing it. `ACADEMIC_DOMAINS` in
 * researchEngine.ts includes "business", and the arXiv/PubMed/Semantic
 * Scholar/OpenAlex tier is KEYLESS — it runs on an Anthropic-only key with no
 * web search configured. So a run would come back `grounding: "external"`
 * carrying real URLs, and the honest-looking label "research-backed" would be
 * printed in gold over Cole's PRICE, sourced from paper abstracts about
 * adolescent athletes.
 *
 * A peer-reviewed paper is excellent evidence about physiology and no evidence
 * at all about what a parent replies to. For a marketing claim, only the live
 * web tier counts. When it is absent — which is the default today — the honest
 * answer is that this is a guess, and the system says so.
 */
export function marketSourceCount(rawResults: ResearchResult[] | undefined): number {
  // "serpapi", not "serp" — the emitted ResearchSource value. The old literal
  // silently discarded every real market source (one grep hit repo-wide, this
  // filter). Typed as ResearchResult[] so tsc rejects a stray literal next time.
  return (rawResults ?? []).filter(
    (r) => r?.url && (r.source === "web" || r.source === "serpapi")
  ).length;
}

function groundingNote(g: Grounding, sourceCount: number): string {
  // "(listed below)" was a promise nothing kept — the Business page never
  // rendered the source list, so the most authoritative-sounding label in the
  // system pointed at evidence Cole could not open. The links are rendered now;
  // this sentence stays true only as long as they are.
  if (g === "external") return `Grounded in ${sourceCount} retrieved source${sourceCount === 1 ? "" : "s"} — links below.`;
  if (g === "internal") return "Grounded in your own corpus and prior results — not external research.";
  return "NOT RESEARCH-BACKED. This is the model's prior, i.e. a plausible guess. Treat it as a hypothesis to test, not a finding.";
}

// ── 1. ANGLES: research-backed hypotheses ────────────────────────────

export type ProposedAngle = {
  title: string;
  hypothesis: string;
  audience: string;
  rationale: string;
};

/**
 * Propose marketing angles for Cole's remote business, grounded in real
 * research where research is available and HONESTLY LABELLED where it isn't.
 *
 * Deliberately bounded: it runs ONE research pass and proposes. It does not
 * loop until confident. The output is a set of bets to test, and the testing
 * is what produces the real answer.
 */
export async function proposeAngles(opts: { count?: number; audience?: string } = {}): Promise<{
  ok: boolean;
  grounding: Grounding;
  groundingNote: string;
  sources: Array<{ title: string; url?: string; source: string }>;
  angles: Array<ProposedAngle & { id: string }>;
  error?: string;
}> {
  const count = Math.min(Math.max(opts.count ?? 3, 1), 6);
  const { businessContextBlock } = await import("./positioning.ts");
  const context = await businessContextBlock();

  // What has ALREADY worked or failed for him outranks anything researched.
  const priorEvidence = await performanceEvidence();

  let researchText = "";
  let grounding: Grounding = "none";
  let sources: Array<{ title: string; url?: string; source: string }> = [];
  try {
    const { runResearch } = await import("../research/researchEngine.ts");
    const { businessResearchContext } = await import("./positioning.ts");
    const res: any = await runResearch({
      query:
        `What actually persuades the parents of high-school athletes to hire a remote strength coach they will ` +
        `never meet in person — the specific fears, objections, and language they use. Context: ${await businessResearchContext()}`,
      operator: "business",
      depth: "deep",
      subject: "what persuades parents to hire a remote athletic coach",
      kind: "topic",
    });
    const body = [res?.synthesis, ...(res?.insights ?? [])].filter(Boolean).join("\n\n");
    if (body && !engineUnavailableText(body)) {
      researchText = body.slice(0, 5000);
      sources = (res?.rawResults ?? [])
        .filter((r: any) => r.source !== "llm" && r.url)
        .slice(0, 6)
        .map((r: any) => ({ title: r.title, url: r.url, source: r.source }));
      // Market sources only — a PubMed abstract is not evidence about buyers.
      grounding = groundingFromResearch(
        res?.grounding,
        marketSourceCount(res?.rawResults),
        !!priorEvidence
      );
    }
  } catch {
    /* research down — proceed, and SAY it's a guess */
  }
  // Research never ran (threw, or returned engine-error text) — his own results
  // are then the only evidence there is, and only if he actually has some.
  if (grounding === "none" && priorEvidence) grounding = "internal";

  const res = await runLLM({
    taskType: "chat",
    operators: { primary: "business", secondaries: ["content"] },
    noReuse: true,
    omitToolCatalog: true,
    input:
      `${context}\n\n` +
      (researchText ? `═══ RESEARCH RETRIEVED ═══\n${researchText}\n\n` : "") +
      (priorEvidence ? `═══ WHAT HAS ACTUALLY HAPPENED FOR COLE (outranks the research above) ═══\n${priorEvidence}\n\n` : "") +
      `Propose ${count} distinct MARKETING ANGLES for Cole's remote coaching business.\n\n` +
      `An angle is a testable hypothesis about what will make a specific person stop and reply — not a slogan ` +
      `and not a campaign. Each must be different in KIND, not three rewordings of one idea.\n\n` +
      `RULES:\n` +
      `- Ground each angle in the research or in Cole's confirmed facts. Where you are extrapolating, say so ` +
      `  inside the rationale in plain words.\n` +
      `- Never invent a statistic, a result, or a testimonial. If proof would help and none is stated in the ` +
      `  facts, say what proof would be needed instead of inventing it.\n` +
      `- Cole is a standard-setter, not a guarantee coach. No "we'll get you X".\n` +
      `- The parent is usually the buyer for a school-age athlete.\n` +
      `- Nothing may target the athletes at the gym that employs him.\n\n` +
      `Return EXACTLY this, repeated ${count} times, nothing else:\n` +
      `TITLE: <short handle, under 8 words>\n` +
      `AUDIENCE: <who exactly this speaks to>\n` +
      `HYPOTHESIS: <what it claims will resonate, and why that person would reply>\n` +
      `RATIONALE: <what this rests on — cite the research or the fact; say plainly if it's extrapolation>\n` +
      `---`,
  });

  const text = (res.text ?? "").trim();
  if (!text || engineUnavailableText(text)) {
    return {
      ok: false, grounding, groundingNote: groundingNote(grounding, sources.length), sources, angles: [],
      error: "No engine available — refusing to invent marketing angles. (Hard rule 3: never file error text as content.)",
    };
  }

  const parsed = parseAngles(text);
  if (parsed.length === 0) {
    return { ok: false, grounding, groundingNote: groundingNote(grounding, sources.length), sources, angles: [], error: "Could not parse any angle from the model's reply." };
  }

  const saved: Array<ProposedAngle & { id: string }> = [];
  for (const a of parsed.slice(0, count)) {
    const row = await prisma.marketingAngle.create({
      data: {
        title: a.title, hypothesis: a.hypothesis, audience: a.audience, rationale: a.rationale,
        grounding, sources: sources.length ? (sources as any) : undefined,
      },
    });
    saved.push({ ...a, id: row.id });
  }
  return { ok: true, grounding, groundingNote: groundingNote(grounding, sources.length), sources, angles: saved };
}

/** PURE — parse the model's angle block. Testable without a key. */
export function parseAngles(text: string): ProposedAngle[] {
  const out: ProposedAngle[] = [];
  for (const chunk of text.split(/^---\s*$/m)) {
    const grab = (label: string) =>
      new RegExp(`^${label}:\\s*(.+?)\\s*$`, "im").exec(chunk)?.[1]?.trim() ?? "";
    const title = grab("TITLE");
    const hypothesis = grab("HYPOTHESIS");
    if (!title || !hypothesis) continue;
    out.push({ title, hypothesis, audience: grab("AUDIENCE") || "parent of a high-school athlete", rationale: grab("RATIONALE") });
  }
  return out;
}

// ── 2. ASSETS: copy that carries its evidence ────────────────────────

/**
 * Draft one marketing asset FROM an angle. The angle's grounding rides along,
 * so Cole is never handed copy without being told how much to trust the idea
 * underneath it.
 */
export async function draftAsset(angleId: string, format: MarketingFormat): Promise<{
  ok: boolean; body?: string; grounding?: Grounding; groundingNote?: string; angle?: string; error?: string;
}> {
  const angle = await prisma.marketingAngle.findUnique({ where: { id: angleId } });
  if (!angle) return { ok: false, error: `No angle with id ${angleId}.` };
  if (!(MARKETING_FORMATS as readonly string[]).includes(format)) {
    return { ok: false, error: `format must be one of: ${MARKETING_FORMATS.join(", ")}` };
  }

  const { businessContextBlock } = await import("./positioning.ts");
  // WHAT IS ACTUALLY BEING SOLD. Without this the copy invents a package and
  // a price every time, and Cole ends up with five emails describing five
  // different businesses. With no active offer the block says so explicitly
  // and forbids inventing one — an absent block reads as "no constraint".
  const { offerContextBlock } = await import("./offers.ts");
  const shape: Record<MarketingFormat, string> = {
    email: "A short email. Subject line on the first line prefixed 'SUBJECT:', then the body. Under 150 words.",
    instagram_post: "A single Instagram caption. First line has to earn the second. Under 120 words.",
    instagram_carousel: "A carousel: 5-7 slides, one idea per slide, 'SLIDE n:' prefixes. Slide 1 is the hook.",
    dm: "A direct message to one person. Under 60 words. It must not read like a template.",
    landing_section: "One section of a landing page: a heading and 2-3 short paragraphs.",
  };

  const res = await runLLM({
    taskType: "chat",
    operators: { primary: "content", secondaries: ["business"] },
    noReuse: true,
    omitToolCatalog: true,
    input:
      `${await businessContextBlock()}\n\n` +
      `${await offerContextBlock()}\n\n` +
      `═══ THE ANGLE YOU ARE WRITING FROM ═══\n` +
      `${angle.title}\nAudience: ${angle.audience}\nHypothesis: ${angle.hypothesis}\nRests on: ${angle.rationale ?? "—"}\n\n` +
      `Write: ${shape[format]}\n\n` +
      `RULES — not style preferences:\n` +
      `- Never state a result, number, or testimonial that isn't in the confirmed facts. Inventing social proof ` +
      `  is the one unrecoverable mistake here.\n` +
      `- Standard-setter, not guarantee coach. Requirement and capability, never "we'll get you X".\n` +
      `- No "hope this finds you well", no fake urgency, no emoji, no engagement-bait questions.\n` +
      `- One clear ask, easy to decline.\n\n` +
      `Return ONLY the asset.`,
  });

  const body = (res.text ?? "").trim();
  if (!body || body.length < 20 || engineUnavailableText(body)) {
    return { ok: false, error: `No usable draft — the model returned an error or empty text. Nothing filed.` };
  }
  const g = angle.grounding as Grounding;
  const sourceCount = Array.isArray(angle.sources) ? (angle.sources as any[]).length : 0;
  return { ok: true, body, grounding: g, groundingNote: groundingNote(g, sourceCount), angle: angle.title };
}

// ── 3. THE RESULTS LOOP: his data beats the research ─────────────────

/**
 * Record what actually happened. This is the function that makes the whole
 * engine worth more than an afternoon of googling: after twenty uses, Cole
 * knows which angle earns rather than which sounded good.
 */
export async function recordOutcome(input: {
  angleId: string;
  used?: number;
  replies?: number;
  conversions?: number;
  leadId?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const angle = await prisma.marketingAngle.findUnique({ where: { id: input.angleId } });
  if (!angle) return { ok: false, error: `No angle with id ${input.angleId}.` };
  await prisma.marketingAngle.update({
    where: { id: input.angleId },
    data: {
      timesUsed: { increment: Math.max(0, input.used ?? 0) },
      replies: { increment: Math.max(0, input.replies ?? 0) },
      conversions: { increment: Math.max(0, input.conversions ?? 0) },
      ...(angle.status === "proposed" ? { status: "active" } : {}),
    },
  });
  // Attribution: angle → lead → client → payment. Without this link Cole
  // learns which angle got REPLIES but never which one got PAID.
  if (input.leadId) {
    await prisma.lead.update({ where: { id: input.leadId }, data: { angleId: input.angleId } }).catch(() => {});
  }
  return { ok: true };
}

/**
 * What his own data says — the honest version, including how thin it is.
 *
 * Small samples are the trap here: 1 reply from 3 sends is not a 33% reply
 * rate, it is noise, and presenting it as a rate would teach him something
 * false. Anything under 10 uses is reported as too early to read.
 */
export async function anglePerformance() {
  const angles = await prisma.marketingAngle.findMany({
    orderBy: { createdAt: "desc" },
    // LEADS ARE THE OUTCOME THAT MATTERS. Replies are counted by hand and so
    // get counted rarely; a lead attributed through an intake ref lands on its
    // own, which makes it the one number here that can be trusted to be complete.
    include: { _count: { select: { leads: true } } },
  });
  const rows = angles.map((a) => {
    const enough = a.timesUsed >= 10;
    return {
      id: a.id,
      title: a.title,
      audience: a.audience,
      status: a.status,
      grounding: a.grounding,
      timesUsed: a.timesUsed,
      replies: a.replies,
      conversions: a.conversions,
      leads: a._count.leads,
      // Carried to the UI so "research-backed" is a claim Cole can open and
      // check, rather than a colour. An unopenable citation is a vibe.
      sources: Array.isArray(a.sources) ? (a.sources as any[]).slice(0, 6) : [],
      replyRate: enough ? Math.round((a.replies / a.timesUsed) * 100) : null,
      verdict: a._count.leads > 0
        // One real lead outranks any rate. It is the only number here that
        // arrived on its own rather than being remembered and typed in.
        ? `${a._count.leads} lead${a._count.leads === 1 ? "" : "s"} came from this${a.timesUsed ? ` over ${a.timesUsed} sends` : ""}`
        : !a.timesUsed
          ? "never used"
          : enough
            ? `${Math.round((a.replies / a.timesUsed) * 100)}% reply rate over ${a.timesUsed} sends, no leads yet`
            : `too early to read — ${a.replies}/${a.timesUsed} so far (needs 10+ to mean anything)`,
    };
  });
  const totalUses = rows.reduce((s, r) => s + r.timesUsed, 0);
  return {
    angles: rows,
    totalUses,
    headline:
      totalUses === 0
        ? "No angle has been used yet — every recommendation here is still a hypothesis from research, not a finding from your market."
        : totalUses < 20
          ? `${totalUses} sends across ${rows.length} angle(s). Still too thin to trust: keep sending before you conclude anything.`
          : `${totalUses} sends across ${rows.length} angle(s) — enough to start believing the differences.`,
  };
}

/** His own results, formatted for injection into the angle prompt. */
async function performanceEvidence(): Promise<string> {
  const perf = await anglePerformance().catch(() => null);
  if (!perf || perf.totalUses === 0) return "";
  const used = perf.angles.filter((a) => a.timesUsed > 0);
  if (used.length === 0) return "";
  return (
    used.map((a) => `- "${a.title}" (${a.audience}): ${a.verdict}`).join("\n") +
    `\n\nThis is real evidence from Cole's own market and OUTRANKS any general research. ` +
    `Lean toward what has worked; do not re-propose an angle that has been used 10+ times with no replies.`
  );
}
