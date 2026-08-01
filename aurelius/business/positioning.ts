// aurelius/business/positioning.ts
//
// THE POSITIONING SPINE — how Cole gets to an offer without Aurelius
// inventing one.
//
//   seedBusinessProfile()  — Cole's stated facts → Living Knowledge (once)
//   businessContextBlock() — those facts injected into business/content turns
//   openGaps()             — what's still unknown, ranked, with what it blocks
//   recordGapAnswer()      — Cole answers → knowledge write (his own truth,
//                            explicit action, no confirm round-trip)
//   businessSnapshot()     — where the business actually stands, honestly
//   proposeOffer()         — an offer PROPOSAL grounded only in confirmed
//                            facts, filed for Cole's confirm (never applied
//                            on its own — an offer is his call by definition)
//
// Hard rules carried: nothing outward (no publishing, no outreach — the
// content lane owns that and gates it); offers land as proposals with
// origin "chat" so the keyhole can never auto-apply them; every claim in a
// generated offer must trace to a confirmed fact or it gets called out as
// an assumption.

import { prisma } from "../core/db/prisma.ts";
import { setKnowledge, getKnowledge, resolveOperatorId } from "../knowledge/store.ts";
import { runLLM } from "../llm/runLLM.ts";
import { engineUnavailableText } from "../llm/nonAnswer.ts";
import { extractDirectives } from "../llm/directiveParser.ts";
import { CONFIRMED_FACTS, OPEN_QUESTIONS, BUSINESS_SCOPE, type OpenQuestion } from "./profile.ts";

/** The business lens owns this knowledge. */
async function businessOperatorId(): Promise<string | null> {
  return (await resolveOperatorId("business").catch(() => null)) ?? null;
}

/**
 * Seed Cole's stated facts into Living Knowledge. Idempotent: an existing
 * entry is left alone, because Cole's later corrections outrank this seed.
 * Returns what it actually wrote.
 */
export async function seedBusinessProfile(): Promise<{ written: string[]; skipped: string[] }> {
  const opId = await businessOperatorId();
  if (!opId) return { written: [], skipped: [] };
  const written: string[] = [];
  const skipped: string[] = [];
  for (const fact of CONFIRMED_FACTS) {
    const existing = await getKnowledge(opId, BUSINESS_SCOPE, fact.key, { includeInactive: false });
    if (existing) {
      skipped.push(fact.key);
      continue;
    }
    await setKnowledge({
      operatorId: opId,
      scope: BUSINESS_SCOPE,
      key: fact.key,
      value: fact.value,
      sourceType: "cole_conversation",
      rationale: `Stated by Cole in the business foundation session. ${fact.note}`,
      updatedBy: "cole",
    });
    written.push(fact.key);
  }
  return { written, skipped };
}

/** Every business fact currently known, newest value per key. */
export async function knownFacts(): Promise<Array<{ key: string; value: string }>> {
  const opId = await businessOperatorId();
  if (!opId) return [];
  const rows = await prisma.knowledgeEntry.findMany({
    where: { operatorId: opId, scope: BUSINESS_SCOPE, active: true },
    select: { key: true, value: true },
    orderBy: { key: "asc" },
  });
  return rows.map((r) => ({ key: r.key, value: String((r.value as any) ?? "") }));
}

/** Unanswered questions, most-unblocking first. */
export async function openGaps(): Promise<OpenQuestion[]> {
  const known = new Set((await knownFacts()).map((f) => f.key));
  return OPEN_QUESTIONS.filter((q) => !known.has(q.key)).sort((a, b) => a.priority - b.priority);
}

/** Cole answers a gap. His own words about his own business — applied directly. */
export async function recordGapAnswer(key: string, answer: string): Promise<{ ok: boolean; error?: string }> {
  const q = OPEN_QUESTIONS.find((x) => x.key === key);
  if (!q) return { ok: false, error: `unknown business question: ${key}` };
  if (!answer.trim()) return { ok: false, error: "empty answer" };
  const opId = await businessOperatorId();
  if (!opId) return { ok: false, error: "no business operator" };
  await setKnowledge({
    operatorId: opId,
    scope: BUSINESS_SCOPE,
    key,
    value: answer.trim(),
    sourceType: "cole_conversation",
    rationale: `Cole answered: "${q.question}"`,
    updatedBy: "cole",
  });
  return { ok: true };
}

/**
 * The business facts, formatted for prompt injection. Injected on business
 * and content turns so the lens reasons from Cole's reality instead of a
 * generic youth-performance persona. Ends with the honest unknowns — a
 * model that can see the gaps stops filling them in.
 */
export async function businessContextBlock(): Promise<string> {
  const facts = await knownFacts();
  if (facts.length === 0) return "";
  const gaps = await openGaps();
  const lines = [
    "═══ COLE'S BUSINESS — CONFIRMED FACTS ═══",
    "Everything below came from Cole directly. Reason FROM it; never contradict it, never re-derive a generic persona.",
    "",
    ...facts.map((f) => `• ${f.key.replace(/_/g, " ")}: ${f.value}`),
  ];
  if (gaps.length > 0) {
    lines.push(
      "",
      "STILL UNKNOWN (never invent these — say plainly that you don't know, or ask):",
      ...gaps.slice(0, 5).map((g) => `• ${g.key.replace(/_/g, " ")}`)
    );
  }
  return lines.join("\n");
}

/** Where the business actually stands — facts, and what would sharpen them. */
export async function businessSnapshot() {
  const [facts, gaps] = await Promise.all([knownFacts(), openGaps()]);
  return {
    facts,
    openGaps: gaps.map((g) => ({ key: g.key, question: g.question, sharpens: g.blocks })),
    summary:
      `${facts.length} confirmed fact(s), ${gaps.length} thing(s) that would sharpen the picture. ` +
      "Work proceeds either way — unknowns are marked as assumptions, never used as a reason to stall.",
  };
}

/**
 * Draft an offer PROPOSAL from confirmed facts. Refuses honestly when the
 * blocking gaps are still open — a priced offer built on unknown capacity
 * and an unknown gym arrangement is a guess wearing a spreadsheet.
 * Lands as a pending KnowledgeProposal: Cole confirms, corrects, or denies.
 */
export async function proposeOffer(): Promise<
  { ok: true; proposal: string; proposalId?: string } | { ok: false; error: string; askFirst?: string[] }
> {
  // No gate (Cole's modularity ruling): unknowns get marked as assumptions
  // in the draft, they never stop the work. The open questions ride along
  // so the model knows exactly what it's assuming.
  const snap = await businessSnapshot();
  const opId = await businessOperatorId();
  if (!opId) return { ok: false, error: "no business operator" };

  const factBlock = snap.facts.map((f) => `- ${f.key}: ${f.value}`).join("\n");
  const unknownBlock = snap.openGaps.length
    ? `\n\n═══ NOT KNOWN — assume, mark it, and move on ═══\n${snap.openGaps.map((g) => `- ${g.key}`).join("\n")}`
    : "";
  const response = await runLLM({
    taskType: "chat",
    operators: { primary: "business", secondaries: ["content"] },
    noReuse: true,
    omitToolCatalog: true,
    input: `
Draft ONE concrete offer for Cole's coaching business, from the confirmed facts below.

Rules:
- Ground every element in a stated fact. Where you must assume something, mark it "ASSUMPTION:" on its own line — do not smuggle guesses in as fact.
- Serve the NEAR-TERM goal (growing the high-school athletes at his gym), not an online fantasy.
- Lead with the buyer's job, not "training". The measured metrics are the proof — use them.
- His method edge (athletes who understand and can leverage their own bodies, not compliance-followers) must be the spine of the promise, not a footnote.
- Parents typically buy at this age; write the promise so both athlete and parent recognise it.

Structure, under 300 words:
NAME — what it's called
WHO — the exact athlete it's for
PROMISE — the outcome, in the buyer's language, backed by the tracked metrics
SHAPE — format, length, what happens week to week
PROOF — how results get demonstrated
WHY HIM — the one line no competing gym can copy
ASSUMPTIONS — anything you had to guess

═══ CONFIRMED FACTS ═══
${factBlock}${unknownBlock}
`.trim(),
  });

  const text = (response.text ?? "").trim();
  if (!text || engineUnavailableText(text)) {
    return { ok: false, error: "no LLM engine available to draft the offer" };
  }
  const clean = extractDirectives(text).cleanedText || text;

  // Files as a pending proposal — an offer is Cole's decision by definition.
  // origin "chat" keeps the confirm loop (the keyhole can never auto-apply it).
  let proposalId: string | undefined;
  try {
    const { createProposal } = await import("../knowledge/proposals.ts");
    const p = await createProposal({
      operatorId: opId,
      operatorName: "business",
      intentClassId: "business_offer",
      scope: BUSINESS_SCOPE,
      key: "current_offer",
      proposedValue: clean,
      rationale: "Drafted from Cole's confirmed business facts — his call to confirm, correct, or bin.",
      coleNaturalLanguage: "draft me an offer from what you know",
      origin: "chat",
    });
    proposalId = p.id;
  } catch (err) {
    console.warn("[business] offer proposal filing failed (draft still returned):", (err as any)?.message ?? err);
  }
  return { ok: true, proposal: clean, proposalId };
}

/**
 * MARKETING OPTIONS — the anti-funnel (Cole's modularity ruling).
 *
 * Not "here is your offer." Several genuinely different approaches to a
 * marketing question, each grounded in live research AND in Cole's
 * confirmed facts, each with what it would actually demand of him and
 * where it fails. He picks, adapts, or bins — the point is an informed
 * decision, not a prescribed path.
 *
 * Research-first by design: it runs the research lane on the question so
 * the options carry evidence rather than the model's priors, and says so
 * honestly when nothing external came back.
 */
export async function marketingOptions(
  question: string
): Promise<{ ok: boolean; options?: string; grounding?: string; error?: string }> {
  const q = question.trim();
  if (!q) return { ok: false, error: "ask a marketing question to explore" };

  // Live research first — the whole point is informed, not improvised.
  let evidence = "";
  let grounding = "none";
  try {
    const { runResearch } = await import("../research/researchEngine.ts");
    const res: any = await runResearch({
      query: `${q} — for a youth/high-school athletic performance coach growing a local in-person practice`,
      operator: "business",
      depth: "deep",
      subject: q.slice(0, 80),
      kind: "topic",
    });
    const body = [res?.synthesis, ...(res?.insights ?? [])].filter(Boolean).join("\n\n");
    if (body && !engineUnavailableText(body)) {
      evidence = body.slice(0, 6000);
      grounding = res?.grounding ?? "internal";
    }
  } catch (err) {
    console.warn("[business] research pass failed — options will be model-only:", (err as any)?.message ?? err);
  }

  const snap = await businessSnapshot();
  const factBlock = snap.facts.map((f) => `- ${f.key}: ${f.value}`).join("\n");

  const response = await runLLM({
    taskType: "chat",
    operators: { primary: "business", secondaries: ["content"] },
    noReuse: true,
    omitToolCatalog: true,
    input: `
Cole is thinking about: "${q}"

Give him THREE genuinely different approaches — not three flavours of the same idea. He decides; you inform.

For each: a name, what it actually is, why it fits (or strains against) his confirmed facts, what it would demand of him in time/skill/money, where it typically fails, and the smallest way to test it cheaply.

Hard rules:
- He is a STANDARD-SETTER, not a promise/guarantee coach. Never write him guarantee-style marketing.
- Ground claims in the research below where it applies; where you're reasoning from priors instead, say so.
- Do not converge on a recommendation at the end. Name the trade-off he's actually choosing between and stop.
- Under 450 words total.

═══ COLE'S CONFIRMED FACTS ═══
${factBlock}

═══ RESEARCH (${grounding === "external" ? "external sources" : "no external source retrieved — model knowledge only"}) ═══
${evidence || "(nothing retrieved)"}
`.trim(),
  });

  const text = (response.text ?? "").trim();
  if (!text || engineUnavailableText(text)) return { ok: false, error: "no LLM engine available" };
  return { ok: true, options: extractDirectives(text).cleanedText || text, grounding };
}
