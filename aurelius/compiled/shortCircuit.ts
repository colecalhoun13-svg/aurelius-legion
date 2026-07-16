// aurelius/compiled/shortCircuit.ts
//
// THE SHORT-CIRCUIT, IN SHADOW MODE (council work order #8 — the thesis made
// literal). "Lean less on the LLM" cashes out as: a decision that matches
// high-trust, outcome-validated compiled judgment gets answered FROM that
// judgment instead of a fresh frontier call. But an unproven skip serves stale
// judgment confidently — so it runs in SHADOW first (First-Principles and the
// red team converged on this independently):
//
//   CASE     — every decision turn stores its full text + the answer given
//              (lossless, at write time — the Expansionist's closing window)
//              and embeds the decision as a precedent vector.
//   SHADOW   — when a new decision lands ≥ SHADOW_SIM near a past case, we log
//              "would have answered from compiled judgment" with both answers.
//              The frontier still answers. Nothing is skipped.
//   VERDICT  — the Sunday judge batch-grades each shadow pair: did the past
//              answer AGREE with what the frontier said this time?
//   GATE     — canShortCircuit() reads the evidence: ≥ MIN_AGREEMENTS graded
//              agreements, ZERO disagreements in-window. It reports eligibility;
//              actual skipping stays OFF until Cole flips it on the evidence —
//              and per hard rule 1, only ever for inward/reversible turns
//              (chat answers), never outward actions.
//
// llmCallsAvoided stays 0 until a real skip ever happens — shadow hits are
// logged as wouldHaveAvoided, never counted as savings. Honest numbers only.

import { prisma } from "../core/db/prisma.ts";
import { getEmbeddingAdapter } from "../retrieval/embeddingAdapter.ts";
import { upsertEmbedding, searchSimilar } from "../retrieval/vectorStore.ts";

export const SHADOW_SIM = 0.85;     // a "precedent" means nearly the same decision
export const MIN_AGREEMENTS = 10;   // graded agreements before eligibility
const CASE_MSG = "decision:case";
const SHADOW_MSG = "decision:shadow";
const VERDICT_MSG = "decision:shadow_verdict";
const CASE_SOURCE = "decision_case" as const;

async function globalOperatorId(): Promise<string | null> {
  const { resolveOperatorId } = await import("../knowledge/store.ts");
  return resolveOperatorId("global").catch(() => null);
}

/**
 * Record a decision case (lossless) + its precedent vector, and log a shadow
 * event when a past case sits close enough to have answered this one.
 * Fire-and-forget from the chat path; never throws into it.
 */
export async function recordDecisionCase(args: { decision: string; answer: string }): Promise<{ shadowed: boolean }> {
  const decision = (args.decision ?? "").trim();
  const answer = (args.answer ?? "").trim();
  if (decision.length < 10 || !answer) return { shadowed: false };
  const operatorId = await globalOperatorId();
  if (!operatorId) return { shadowed: false };

  const caseRow = await prisma.logEntry.create({
    data: {
      operatorId, type: "trace", level: "info", message: CASE_MSG,
      context: { kind: "decision", name: "case", decision, answer: answer.slice(0, 1500) } as any,
    },
  });

  const adapter = getEmbeddingAdapter();
  if (!adapter) return { shadowed: false }; // case still stored; precedent search needs an engine
  const [vec] = await adapter.embed([decision.slice(0, 6000)]);
  if (!vec) return { shadowed: false };
  const model = `${adapter.name}:${adapter.model}`;

  // Search BEFORE indexing this case — a case must never be its own precedent.
  const hits = await searchSimilar({ embedding: vec, limit: 3, sourceTypes: [CASE_SOURCE], embeddingModel: model });
  await upsertEmbedding({
    sourceType: CASE_SOURCE, sourceId: caseRow.id, chunkIndex: 0,
    chunkText: decision.slice(0, 500), embedding: vec, embeddingModel: model, operatorId,
  });

  const top = hits[0];
  if (!top || top.similarity < SHADOW_SIM) return { shadowed: false };
  const prior = await prisma.logEntry.findUnique({ where: { id: top.sourceId } });
  const priorAnswer = ((prior?.context as any)?.answer ?? "").toString();
  if (!priorAnswer) return { shadowed: false };

  await prisma.logEntry.create({
    data: {
      operatorId, type: "trace", level: "info", message: SHADOW_MSG,
      context: {
        kind: "decision", name: "shadow", caseId: top.sourceId, similarity: top.similarity,
        decision: decision.slice(0, 200),
        priorAnswer: priorAnswer.slice(0, 400),
        currentAnswer: answer.slice(0, 400),
        wouldHaveAvoided: 1, // logged, never counted as savings — shadow only
      } as any,
    },
  });
  console.log(`[shortCircuit] shadow hit (${top.similarity.toFixed(3)}): compiled judgment would have answered this decision`);
  return { shadowed: true };
}

/**
 * Sunday grading: one batch LLM call over the week's ungraded shadow pairs —
 * did the past answer AGREE with the frontier's fresh one on the actual call?
 * Machine-readable verdict rows; keyless → grades nothing, honestly.
 */
export async function gradeShadowAgreements(): Promise<number> {
  const since = new Date(Date.now() - 8 * 86_400_000);
  const [shadows, verdicts] = await Promise.all([
    prisma.logEntry.findMany({ where: { type: "trace", message: SHADOW_MSG, createdAt: { gte: since } }, orderBy: { createdAt: "asc" }, take: 40 }),
    prisma.logEntry.findMany({ where: { type: "trace", message: VERDICT_MSG, createdAt: { gte: since } } }),
  ]);
  const graded = new Set(verdicts.map((v) => (v.context as any)?.shadowId).filter(Boolean));
  const pending = shadows.filter((s) => !graded.has(s.id));
  if (pending.length === 0) return 0;

  const block = pending
    .map((s, i) => {
      const c = s.context as any;
      return `PAIR ${i + 1}\nDECISION: ${c?.decision ?? ""}\nPAST ANSWER: ${c?.priorAnswer ?? ""}\nFRESH ANSWER: ${c?.currentAnswer ?? ""}`;
    })
    .join("\n\n");
  const prompt =
    `Each pair below is the same decision answered twice — once from stored judgment, once fresh. ` +
    `Judge whether they AGREE on the actual CALL (same recommendation, even if worded differently). ` +
    `Phrasing differences don't matter; a different recommendation does.\n\n${block}\n\n` +
    `Reply with EXACTLY one line per pair, nothing else:\nAGREE <pair number>\nDISAGREE <pair number>`;

  const { runLLM } = await import("../llm/runLLM.ts");
  const { engineUnavailableText } = await import("../llm/nonAnswer.ts");
  let text = "";
  try {
    const r = await runLLM({ taskType: "shadow_judge", operator: "global", input: prompt });
    text = r?.text ?? "";
  } catch {
    return 0;
  }
  if (!text || engineUnavailableText(text)) return 0;

  const operatorId = await globalOperatorId();
  if (!operatorId) return 0;
  let gradedNow = 0;
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*(AGREE|DISAGREE)\s+(\d+)\s*$/i);
    if (!m) continue;
    const idx = parseInt(m[2], 10) - 1;
    const shadow = pending[idx];
    if (!shadow) continue;
    await prisma.logEntry.create({
      data: {
        operatorId, type: "trace", level: "info", message: VERDICT_MSG,
        context: { kind: "decision", name: "shadow_verdict", shadowId: shadow.id, agree: /^agree$/i.test(m[1]) } as any,
      },
    });
    gradedNow++;
  }
  return gradedNow;
}

export type GateReport = { eligible: boolean; agreements: number; disagreements: number; reason: string };

/**
 * The evidence gate. Reports whether the shadow record has EARNED a real skip:
 * ≥ MIN_AGREEMENTS graded agreements and ZERO disagreements in-window. This
 * function only reports — actual skipping is a deliberate future flip Cole
 * makes on this evidence, and any correction of a skipped answer must re-arm
 * the frontier (enforced when the flip is built, by design).
 */
export async function canShortCircuit(args?: { sinceDays?: number }): Promise<GateReport> {
  const since = new Date(Date.now() - (args?.sinceDays ?? 30) * 86_400_000);
  const verdicts = await prisma.logEntry.findMany({
    where: { type: "trace", message: VERDICT_MSG, createdAt: { gte: since } },
  });
  let agreements = 0, disagreements = 0;
  for (const v of verdicts) ((v.context as any)?.agree === true ? agreements++ : disagreements++);
  const eligible = agreements >= MIN_AGREEMENTS && disagreements === 0;
  const reason = eligible
    ? `earned: ${agreements} graded agreements, 0 disagreements — compiled judgment is tracking the frontier`
    : `not yet: ${agreements}/${MIN_AGREEMENTS} agreements, ${disagreements} disagreement(s) — the frontier stays on every call`;
  return { eligible, agreements, disagreements, reason };
}
