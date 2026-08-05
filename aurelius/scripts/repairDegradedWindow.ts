// Undo a period of degraded reasoning.
//
//   cd aurelius && npx tsx scripts/repairDegradedWindow.ts --since 2026-07-29
//   (add --apply to actually write; default is a dry run)
//
// WHY THIS EXISTS
// Cole's Railway deploy ran for a week with ANTHROPIC_API_KEY unset on the
// backend. Nothing errored — the router failed over, and 192 of 212 calls were
// served by a substitute model. The problem isn't the week of shallower
// answers; it's that several of them were written into DURABLE state that
// keeps affecting decisions long after the key is fixed:
//
//   1. The reasoning-reuse cache. Answers are re-served for 14 days on a 0.93
//      similarity match WITHOUT calling a model at all. Left alone, the
//      degraded answers outlive the outage by two weeks.
//   2. The decision-curriculum cursor. Cole's corrections are distilled into
//      heuristics ONCE and the cursor advances past them. A week of his
//      corrections were taught by the substitute model and the window is
//      consumed — those corrections will never be revisited.
//   3. Shadow verdicts. These compare a stored answer against a fresh one to
//      decide whether Aurelius may eventually skip the LLM entirely. Verdicts
//      from the window compared one model's answer against another's while
//      labelling it same-model agreement — evidence for a trust gate, built on
//      a category error.
//
// Everything here is reversible in the sense that it only DELETES derived
// state and REWINDS a cursor — no source knowledge, memory, or corpus document
// is touched. What's deleted gets recomputed by the normal loops.

import { prisma } from "../core/db/prisma.ts";

const APPLY = process.argv.includes("--apply");
const sinceArg = process.argv[process.argv.indexOf("--since") + 1];

function parseSince(): Date {
  if (!sinceArg || sinceArg.startsWith("--")) {
    console.error("Missing --since. Example: --since 2026-07-29 (the day the degraded window started)");
    process.exit(1);
  }
  const d = new Date(`${sinceArg}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) {
    console.error(`"${sinceArg}" is not a date. Use YYYY-MM-DD.`);
    process.exit(1);
  }
  return d;
}

async function main() {
  const since = parseSince();
  console.log(`\n${APPLY ? "REPAIRING" : "DRY RUN — nothing will be written"}`);
  console.log(`Degraded window: ${since.toISOString()} → now\n`);

  // ── 1. Reuse cache ────────────────────────────────────────────────
  // Every chat answer cached during the window, plus its retrieval vector.
  // Without this, the degraded answers keep being served with no model call.
  const stale = await prisma.reasoningCacheEntry.findMany({
    where: { domain: "chat_reuse", createdAt: { gte: since } },
    select: { id: true, usageCount: true },
  });
  const alreadyServed = stale.reduce((n, e) => n + (e.usageCount ?? 0), 0);
  console.log(`reuse cache      : ${stale.length} entr(ies) from the window` +
    (alreadyServed ? ` — ${alreadyServed} of them already re-served to you` : ""));
  if (APPLY && stale.length) {
    const ids = stale.map((e) => e.id);
    await prisma.vectorEmbedding.deleteMany({ where: { sourceType: "reasoning_cache", sourceId: { in: ids } } });
    await prisma.reasoningCacheEntry.deleteMany({ where: { id: { in: ids } } });
    console.log(`                   deleted (entries + embeddings)`);
  }

  // ── 2. Decision-curriculum cursor ─────────────────────────────────
  // Rewind so the corrections Cole made during the window get re-distilled by
  // the real model on the next Sunday run. This is the one piece of state
  // whose loss is otherwise permanent — corrections teach exactly once.
  const cursor = await prisma.knowledgeEntry.findFirst({
    where: { scope: "system", key: "decision_curriculum:cursor", active: true },
    select: { id: true, value: true },
  });
  if (!cursor) {
    console.log(`curriculum cursor: none stored — nothing to rewind`);
  } else {
    // The cursor is stored as { since: "<iso>" }, not a bare string — read and
    // write the same shape decisionCurriculum.ts uses, or the rewind is a no-op
    // that silently reports success.
    const current = (cursor.value as any)?.since;
    const currentDate = current ? new Date(current) : null;
    const needsRewind = !currentDate || Number.isNaN(currentDate.getTime()) || currentDate > since;
    console.log(
      `curriculum cursor: ${current ?? "(unset)"} → ` +
        (needsRewind ? since.toISOString() : "already behind the window, leaving it")
    );
    if (APPLY && needsRewind) {
      await prisma.knowledgeEntry.update({
        where: { id: cursor.id },
        data: { value: { since: since.toISOString() } as any },
      });
      console.log(`                   rewound — Sunday 21:00 will re-teach that week's corrections`);
    }
  }

  // ── 3. Shadow verdicts + decision cases ───────────────────────────
  // The trust gate's evidence base. Verdicts from the window are cross-model
  // comparisons mislabelled as same-model agreement.
  const verdictWhere = {
    type: "decision" as const,
    message: { in: ["decision:shadow_verdict", "decision:shadow"] },
    createdAt: { gte: since },
  };
  const verdicts = await prisma.logEntry.count({ where: verdictWhere });
  console.log(`shadow verdicts  : ${verdicts} from the window (evidence for the skip-the-LLM gate)`);
  if (APPLY && verdicts) {
    await prisma.logEntry.deleteMany({ where: verdictWhere });
    console.log(`                   deleted — the gate re-earns its evidence honestly`);
  }

  const caseWhere = { type: "decision" as const, message: "decision:case", createdAt: { gte: since } };
  const cases = await prisma.logEntry.count({ where: caseWhere });
  console.log(`decision cases   : ${cases} from the window (stored as precedent for future decisions)`);
  if (APPLY && cases) {
    await prisma.logEntry.deleteMany({ where: caseWhere });
    console.log(`                   deleted`);
  }

  // ── 4. Report what survives ───────────────────────────────────────
  console.log(`\nNOT touched (and shouldn't be): memories, corpus documents, knowledge entries,`);
  console.log(`confirmed heuristics, missions, bridge signals. Only derived state was cleared.`);
  if (!APPLY) console.log(`\nRe-run with --apply to write these changes.`);
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error("[repair] failed:", err);
  await prisma.$disconnect();
  process.exit(1);
});
