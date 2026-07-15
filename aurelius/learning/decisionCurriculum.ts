// aurelius/learning/decisionCurriculum.ts
//
// THE DECISION CURRICULUM — study COLE, not just the canon.
//
// The council's convergence: the operator already holds the books; what it lacks
// is Cole. The single richest record of "Aurelius decided X and Cole overrode it"
// is the Correction table (before → after · reason). This scans recent corrections
// per operator and distills THE durable decision-heuristic they imply — mined from
// Cole's own reversals — then files it through the exact same propose→confirm gate
// the canon distillation uses. On Cole's tap it becomes a confirmed_heuristic that
// grounds every future turn for that operator (Layer 5.4). The canon becomes Cole.
//
// Honest-failure: no LLM engine → nothing filed. Cursor under scope="system"
// (never embedded, never recalled).

import { prisma } from "../core/db/prisma.ts";
import { runLLM } from "../llm/runLLM.ts";
import { engineUnavailableText } from "../llm/nonAnswer.ts";
import { parseHeuristics, fileProposedHeuristic } from "./distill.ts";

const CURSOR_OP = "global";
const CURSOR_KEY = "decision_curriculum:cursor";
const MAX_OPERATORS_PER_RUN = 8;

async function getCursor(globalId: string): Promise<Date> {
  const row = await prisma.knowledgeEntry.findUnique({
    where: { operatorId_scope_key: { operatorId: globalId, scope: "system", key: CURSOR_KEY } },
  });
  const v = (row?.value as any)?.since;
  const d = v ? new Date(v) : null;
  // Default: look back 30 days on first run.
  return d && !isNaN(d.getTime()) ? d : new Date(Date.now() - 30 * 24 * 3600 * 1000);
}

async function setCursor(globalId: string, since: Date): Promise<void> {
  await prisma.knowledgeEntry.upsert({
    where: { operatorId_scope_key: { operatorId: globalId, scope: "system", key: CURSOR_KEY } },
    update: { value: { since: since.toISOString() } as any },
    create: {
      operatorId: globalId,
      scope: "system",
      key: CURSOR_KEY,
      value: { since: since.toISOString() } as any,
      sourceType: "decision_cursor",
      createdBy: "system",
    },
  });
}

function summarizeCorrection(c: { correctionType: string; before: any; after: any; reason: string | null }): string {
  const show = (v: any) => (v == null ? "" : (typeof v === "string" ? v : JSON.stringify(v)).slice(0, 200));
  const before = show(c.before);
  const after = show(c.after);
  const parts = [`[${c.correctionType}]`];
  if (before) parts.push(`was: ${before}`);
  if (after) parts.push(`Cole corrected to: ${after}`);
  if (c.reason) parts.push(`reason: ${c.reason.slice(0, 200)}`);
  return parts.join(" · ");
}

async function operatorName(operatorId: string): Promise<string | null> {
  const op = await prisma.operator.findUnique({ where: { id: operatorId }, select: { name: true } });
  return op?.name ?? null;
}

export type DecisionCurriculumResult = { ok: boolean; proposed: number; error?: string };

/**
 * Scan recent corrections and propose one heuristic per operator that has them.
 * Advances the cursor to now on success (so each correction teaches once).
 */
export async function runDecisionCurriculum(): Promise<DecisionCurriculumResult> {
  const { resolveOperatorId } = await import("../knowledge/store.ts");
  const globalId = await resolveOperatorId(CURSOR_OP);
  if (!globalId) return { ok: false, proposed: 0, error: "no global operator" };

  const since = await getCursor(globalId);
  const now = new Date();

  const corrections = await prisma.correction.findMany({
    where: { createdAt: { gte: since }, operatorId: { not: null } },
    orderBy: { createdAt: "asc" },
    take: 500,
  });

  // Group by operator.
  const byOp = new Map<string, typeof corrections>();
  for (const c of corrections) {
    const id = c.operatorId!;
    const bucket = byOp.get(id);
    if (bucket) bucket.push(c);
    else byOp.set(id, [c]);
  }

  let proposed = 0;
  let opsProcessed = 0;
  for (const [opId, rows] of byOp) {
    if (opsProcessed >= MAX_OPERATORS_PER_RUN) break;
    opsProcessed++;
    const opName = await operatorName(opId);
    if (!opName) continue;

    const summary = rows.slice(0, 12).map(summarizeCorrection).join("\n");
    const prompt =
      `These are decisions where Cole OVERRODE my ${opName} reasoning — his corrections:\n${summary}\n\n` +
      `Extract THE single durable decision heuristic these corrections imply about how ${opName} decisions should ACTUALLY be made for Cole — ` +
      `a rule to reason FROM next time, in the form "When <situation>, <do this> — because <reason>." ` +
      `Base it strictly on the pattern in his corrections, not generic advice. If there's no real pattern yet, reply exactly NONE.`;

    try {
      const r = await runLLM({ taskType: "decision_curriculum", operator: opName, input: prompt });
      const text = r?.text ?? "";
      if (!text || engineUnavailableText(text) || /^\s*none\s*$/i.test(text)) continue;
      const heuristic = parseHeuristics(text)[0];
      if (!heuristic) continue;

      await fileProposedHeuristic({
        operatorId: opId,
        domain: opName,
        heuristic,
        source: "cole's corrections",
        surfaceTitle: `A principle from your own corrections (${opName})`,
        surfaceBody:
          `You've corrected my ${opName} calls a few times. Here's the rule those corrections imply:\n\n“${heuristic}”\n\n` +
          `Confirm and I'll reason from it — learned from your decisions, not a book. Ignore and it stays an observation.`,
      });
      proposed++;
    } catch (err) {
      console.warn(`[decisionCurriculum] ${opName} failed:`, (err as any)?.message ?? err);
    }
  }

  // Advance the cursor only if we actually got through the corrections (so a
  // keyless run retries next week instead of skipping the window).
  if (proposed > 0 || corrections.length === 0) {
    await setCursor(globalId, now);
  }

  console.log(`[decisionCurriculum] scanned ${corrections.length} corrections across ${byOp.size} operators · proposed ${proposed}`);
  return { ok: true, proposed };
}
