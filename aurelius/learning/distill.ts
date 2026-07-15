// aurelius/learning/distill.ts
//
// TURN STUDY INTO A DECISION HEURISTIC (council flagship fix). Studying a unit
// used to end as a searchable corpus doc — reachable only if the user's phrasing
// happened to embed near it. But the ONE layer that makes Aurelius reason FROM
// something (Layer 5.4, loadOperatorPatternsForPrompt) is fed only by compiled
// patterns mined from experience with Cole — curriculum wrote none. So the field's
// deepest studied principle never steered a decision.
//
// This closes it: after a unit is studied, distill the SINGLE most durable,
// transferable decision heuristic and file it as a `proposed_heuristic`
// CompiledPattern (operator-scoped, domain-tagged), then surface it through the
// exact same propose→confirm gate chat heuristics use (`pattern.confirm`, an
// ungrantable class → executeAction GATES it to a Bridge confirm). On Cole's tap
// it becomes `confirmed_heuristic` and grounds EVERY future turn for that operator.
//
// One heuristic per unit (≤7/week) keeps the Bridge from becoming a firehose.
// Honest-failure: no engine → nothing filed.

import { prisma } from "../core/db/prisma.ts";
import { runLLM } from "../llm/runLLM.ts";
import { resolveOperatorId } from "../knowledge/store.ts";
import { engineUnavailableText } from "../llm/nonAnswer.ts";

/** Parse the model's lines into candidate heuristics (pure, testable). */
export function parseHeuristics(text: string): string[] {
  return (text ?? "")
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*(?:\d+[.)]|[-*•]|heuristic:?)\s*/i, "").trim().replace(/^["'“]|["'”]$/g, ""))
    .filter((l) => l.length > 25 && l.length < 320 && /\b(when|if|because|so that|prefer|avoid|—)\b/i.test(l));
}

/**
 * Distill one durable heuristic from a studied unit and propose it for confirm.
 * Returns the number filed (0 or 1). Fire-and-forget from the caller.
 */
export async function distillAndProposeHeuristic(args: {
  operatorName: string;
  domain: string;
  unitTitle: string;
  synthesisBody: string;
}): Promise<number> {
  try {
    const operatorId = await resolveOperatorId(args.operatorName);
    if (!operatorId) return 0;

    const prompt =
      `From this study of "${args.unitTitle}" in ${args.domain}, extract THE single most durable, ` +
      `transferable DECISION HEURISTIC — a general rule to reason FROM when deciding, not a summary. ` +
      `It must generalize beyond this one work and be genuinely useful. Write ONE line in the form: ` +
      `"When <situation>, <do this> — because <reason>." If nothing rises to a real heuristic, reply exactly NONE.\n\n` +
      `Study:\n${args.synthesisBody.slice(0, 4000)}`;

    const r = await runLLM({ taskType: "curriculum_distill", operator: args.operatorName, input: prompt });
    const text = r?.text ?? "";
    if (!text || engineUnavailableText(text) || /^\s*none\s*$/i.test(text)) return 0;

    const heuristic = parseHeuristics(text)[0];
    if (!heuristic) return 0;

    await fileProposedHeuristic({
      operatorId,
      domain: args.domain,
      heuristic,
      source: `curriculum: ${args.unitTitle}`,
      surfaceTitle: `A principle worth reasoning from (${args.domain})`,
      surfaceBody:
        `From studying "${args.unitTitle}":\n\n“${heuristic}”\n\n` +
        `Confirm and I'll reason from it in ${args.domain} decisions going forward. Ignore and it stays an observation.`,
    });
    return 1;
  } catch (err) {
    console.warn("[distill] non-fatal:", (err as any)?.message ?? err);
    return 0;
  }
}

/**
 * Create a proposed_heuristic CompiledPattern and surface it for Cole's confirm
 * through the pattern.confirm gate (ungrantable → executeAction GATES it to a
 * pending Bridge confirm; the finalizer flips it to confirmed_heuristic, after
 * which it grounds reasoning via Layer 5.4). Shared by curriculum distillation
 * AND the Decision Curriculum (heuristics mined from Cole's own corrections).
 * `source` is kept in the DB for audit but NOT rendered into the reasoning prompt.
 */
export async function fileProposedHeuristic(args: {
  operatorId: string;
  domain: string;
  heuristic: string;
  source: string;
  surfaceTitle: string;
  surfaceBody: string;
}): Promise<string | null> {
  const pattern = await prisma.compiledPattern.create({
    data: {
      operatorId: args.operatorId,
      domain: args.domain,
      entityKey: null,
      patternType: "heuristic",
      patternSignature: { recurringReasoningTheme: args.heuristic, source: args.source } as any,
      status: "proposed_heuristic",
      evidence: [args.source],
      supportCount: 1,
      confidenceScore: 0.5,
    },
  });
  // Index the when-clause so the decision path can retrieve this rule by SITUATION,
  // not shared words (the row is inert until Cole confirms — retrieval filters by
  // status — so embedding at propose-time is safe and saves a confirm-time hook).
  const { indexPatternSafe } = await import("../compiled/patternIndex.ts");
  indexPatternSafe(pattern as any);
  const sourceId = `pattern:${pattern.id}`;
  const already = await prisma.bridgeSignal.count({ where: { sourceType: "heuristic_confirm", sourceId } });
  if (already === 0) {
    const { executeAction } = await import("../autonomy/executor.ts");
    await executeAction({
      actionClass: "pattern.confirm",
      sourceType: "heuristic_confirm",
      sourceId,
      prepare: async () => ({
        title: args.surfaceTitle,
        body: args.surfaceBody,
        domain: "personal",
        payload: { patternId: pattern.id },
      }),
    });
  }
  return pattern.id;
}
