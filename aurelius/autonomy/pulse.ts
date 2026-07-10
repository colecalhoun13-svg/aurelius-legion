// aurelius/autonomy/pulse.ts
//
// The Pulse — nervous system v1. The first background loops that actually
// DO something (the older autonomy loop scaffolds only logged phase names).
//
// - Nightly pulse: closes the day. Computes the intent-vs-action gap from
//   the daily plan vs what actually got done, persists an IntentActionGap
//   row, and surfaces a BridgeSignal so tomorrow's Today view opens with
//   an honest read of yesterday. Deterministic — no LLM required.
// - Weekend pulse: the first cut of the continuous-learning substrate.
//   Runs the research engine over the training operator's standing topics;
//   findings persist to research memory and knowledge proposals queue for
//   Cole's review (propose→confirm — nothing auto-applies).
//
// Hard rule carried: signals only. The pulse never prescribes, never acts
// outward, never touches Living Knowledge directly.

import { prisma } from "../core/db/prisma.ts";
import { runResearch } from "../research/researchEngine.ts";

// Standing research topics until per-operator strategy files ship (Phase 5.5).
const TRAINING_RESEARCH_TOPICS = [
  "rep range optimization for strength endurance in athletes",
  "deload timing signals and fatigue markers in youth athletes",
  "bar speed and velocity loss as autoregulation signals",
];

function dayRange(dateStr?: string): { start: Date; end: Date; dstr: string } {
  const dstr = dateStr ?? new Date().toISOString().slice(0, 10);
  return {
    start: new Date(`${dstr}T00:00:00.000Z`),
    end: new Date(`${dstr}T23:59:59.999Z`),
    dstr,
  };
}

export async function runNightlyPulse(dateStr?: string) {
  const { start, end, dstr } = dayRange(dateStr);
  const date = start;

  const [plan, doneToday, openToday, overdue, habits, habitDone] = await Promise.all([
    prisma.dailyPlan.findUnique({ where: { date } }),
    prisma.task.count({ where: { status: "done", completedAt: { gte: start, lte: end } } }),
    prisma.task.count({
      where: {
        OR: [{ status: "today" }, { scheduledFor: { gte: start, lte: end } }],
        NOT: { status: { in: ["done", "abandoned"] } },
      },
    }),
    prisma.task.count({
      where: { dueDate: { lt: start }, status: { notIn: ["done", "abandoned"] } },
    }),
    prisma.habit.findMany({ where: { active: true }, select: { id: true, name: true } }),
    prisma.habitCompletion.findMany({
      where: { completedAt: { gte: start, lte: end } },
      select: { habitId: true },
    }),
  ]);

  const planned = doneToday + openToday;
  const gapScore = planned > 0 ? Math.min(1, openToday / planned) : 0;
  const doneHabitIds = new Set(habitDone.map((h) => h.habitId));
  const missedHabits = habits.filter((h) => !doneHabitIds.has(h.id)).map((h) => h.name);

  const intent = plan?.focus?.trim() || "(no focus was set)";
  const action = `${doneToday} done, ${openToday} left open, ${overdue} overdue`;

  const gap = await prisma.intentActionGap.create({
    data: {
      domain: "personal",
      windowStart: start,
      windowEnd: end,
      intent,
      action,
      gapScore,
      gapSummary:
        gapScore >= 0.5
          ? `More than half of what was on deck didn't move. Focus was: ${intent}`
          : `Solid follow-through on the day's intent.`,
    },
  });

  const bodyLines = [
    `**Focus:** ${intent}`,
    `**Result:** ${action}`,
    missedHabits.length > 0 ? `**Habits missed:** ${missedHabits.join(", ")}` : "",
    gapScore >= 0.5 ? `Follow-through was ${Math.round((1 - gapScore) * 100)}%. Worth a look.` : "",
  ].filter(Boolean);

  const signal = await prisma.bridgeSignal.create({
    data: {
      kind: "gap_alert",
      domain: "personal",
      sourceType: "ritual",
      sourceId: gap.id,
      severity: gapScore >= 0.5 || overdue > 2 ? "attention" : "info",
      title: `Day closed — ${doneToday}/${planned || "0"} done${overdue ? `, ${overdue} overdue` : ""}`,
      body: bodyLines.join("\n"),
    },
  });

  console.log(`[pulse] nightly ${dstr}: gap=${gapScore.toFixed(2)}, signal=${signal.id}`);
  return { date: dstr, gapScore, doneToday, openToday, overdue, missedHabits, signalId: signal.id };
}

export async function runWeekendPulse() {
  // Scoreboard row for the pass — the measurement plane sees every sweep.
  const run = await prisma.ingestionRun.create({
    data: {
      runType: "weekend_deep",
      operatorName: "training",
      triggeredBy: "schedule",
      sourcesQueried: TRAINING_RESEARCH_TOPICS,
    },
  });

  const results: Array<{ topic: string; insights: number; proposals: number; error?: string }> = [];

  for (const topic of TRAINING_RESEARCH_TOPICS) {
    try {
      const r = await runResearch({ query: topic, operator: "training", depth: "medium" });
      results.push({
        topic,
        insights: r.insights.length,
        proposals: r.proposalsCreated,
      });

      // Real findings join the corpus — the brain grows from its own
      // sweeps (all four auto-awareness writes fire, wiki refreshes).
      if (r.synthesis && r.insights.length > 0) {
        const { ingestDocument } = await import("../corpus/ingest.ts");
        await ingestDocument({
          title: `Research: ${topic}`,
          content: [r.synthesis, "", ...r.insights.map((i) => `- ${i}`)].join("\n"),
          sourceType: "research",
          domain: "cole_training",
          operatorName: "training",
          triggeredBy: "schedule",
        }).catch((err: any) =>
          console.warn("[pulse] corpus ingestion of findings failed (non-fatal):", err)
        );
      }
    } catch (err: any) {
      results.push({ topic, insights: 0, proposals: 0, error: err?.message ?? String(err) });
    }
  }

  const totalInsights = results.reduce((s, r) => s + r.insights, 0);
  const totalProposals = results.reduce((s, r) => s + r.proposals, 0);
  const failed = results.filter((r) => r.error).length;

  const signal = await prisma.bridgeSignal.create({
    data: {
      kind: "background_result",
      domain: "training",
      sourceType: "research_ingestion",
      severity: totalProposals > 0 ? "notice" : "info",
      title: `Weekend research pass — ${totalInsights} findings${totalProposals ? `, ${totalProposals} proposals awaiting review` : ""}`,
      body: results
        .map((r) =>
          r.error
            ? `✗ ${r.topic}: ${r.error.slice(0, 80)}`
            : `• ${r.topic}: ${r.insights} insights${r.proposals ? `, ${r.proposals} proposals` : ""}`
        )
        .join("\n"),
    },
  });

  await prisma.ingestionRun.update({
    where: { id: run.id },
    data: {
      status: failed === results.length ? "failed" : "completed",
      finishedAt: new Date(),
      findingsCount: totalInsights,
      proposalsCreated: totalProposals,
      errors: failed > 0 ? results.filter((r) => r.error).map((r) => `${r.topic}: ${r.error}`) : undefined,
    },
  });

  console.log(
    `[pulse] weekend: ${totalInsights} insights, ${totalProposals} proposals, ${failed} topics failed`
  );
  return { results, totalInsights, totalProposals, signalId: signal.id };
}
