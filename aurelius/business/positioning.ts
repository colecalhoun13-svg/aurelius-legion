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

/** Where the business actually stands — facts, gaps, and what's blocked. */
export async function businessSnapshot() {
  const [facts, gaps] = await Promise.all([knownFacts(), openGaps()]);
  return {
    facts,
    openGaps: gaps.map((g) => ({ key: g.key, question: g.question, blocks: g.blocks })),
    readyForOffer: gaps.filter((g) => g.priority <= 3).length === 0,
    summary:
      `${facts.length} confirmed fact(s), ${gaps.length} open question(s). ` +
      (gaps.filter((g) => g.priority <= 3).length === 0
        ? "Enough is known to draft a real offer."
        : `Offer construction is blocked until these are answered: ${gaps
            .filter((g) => g.priority <= 3)
            .map((g) => g.key)
            .join(", ")}.`),
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
  const snap = await businessSnapshot();
  if (!snap.readyForOffer) {
    return {
      ok: false,
      error: snap.summary,
      askFirst: snap.openGaps.filter((g) => OPEN_QUESTIONS.find((q) => q.key === g.key)!.priority <= 3).map((g) => g.question),
    };
  }
  const opId = await businessOperatorId();
  if (!opId) return { ok: false, error: "no business operator" };

  const factBlock = snap.facts.map((f) => `- ${f.key}: ${f.value}`).join("\n");
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
${factBlock}
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
