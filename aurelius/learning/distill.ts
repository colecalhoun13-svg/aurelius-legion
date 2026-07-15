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

    const pattern = await prisma.compiledPattern.create({
      data: {
        operatorId,
        domain: args.domain,
        entityKey: null,
        patternType: "heuristic",
        patternSignature: { recurringReasoningTheme: heuristic, source: `curriculum: ${args.unitTitle}` } as any,
        status: "proposed_heuristic",
        evidence: [args.unitTitle],
        supportCount: 1,
        confidenceScore: 0.5,
      },
    });

    // Surface for confirm through the pattern.confirm gate (ungrantable → GATES to
    // a pending Bridge confirm; the finalizer flips it to confirmed_heuristic).
    const sourceId = `pattern:${pattern.id}`;
    const already = await prisma.bridgeSignal.count({ where: { sourceType: "heuristic_confirm", sourceId } });
    if (already === 0) {
      const { executeAction } = await import("../autonomy/executor.ts");
      await executeAction({
        actionClass: "pattern.confirm",
        sourceType: "heuristic_confirm",
        sourceId,
        prepare: async () => ({
          title: `A principle worth reasoning from (${args.domain})`,
          body:
            `From studying "${args.unitTitle}":\n\n“${heuristic}”\n\n` +
            `Confirm and I'll reason from it in ${args.domain} decisions going forward. Ignore and it stays an observation.`,
          domain: "personal",
          payload: { patternId: pattern.id },
        }),
      });
    }
    return 1;
  } catch (err) {
    console.warn("[distill] non-fatal:", (err as any)?.message ?? err);
    return 0;
  }
}
