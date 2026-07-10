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
import { getKnowledge, resolveOperatorId } from "../knowledge/store.ts";

// WHOLE-LIFE SWEEP CONFIG (OG doc Parts XI-XIII). Each operator sweeps
// its own standing topics; Cole steers any lane via Living Knowledge
// (research.standing_topics on that operator) — these are fallbacks
// until an entry exists. Findings ingest into each lane's corpus, which
// refreshes its living document.
const SWEEPS: Array<{ operator: string; domain: string; fallback: string[] }> = [
  {
    operator: "training",
    domain: "cole_training",
    fallback: [
      "rep range optimization for strength endurance in athletes",
      "deload timing signals and fatigue markers in youth athletes",
      "bar speed and velocity loss as autoregulation signals",
    ],
  },
  {
    operator: "business",
    domain: "business",
    fallback: [
      "client retention systems for athletic performance coaching businesses",
      "offer positioning and pricing for youth athlete training",
      "lead generation channels for local sports performance coaches",
    ],
  },
  {
    operator: "wealth",
    domain: "wealth",
    fallback: [
      "current macro liquidity regime and implications for risk assets",
      "bitcoin and major crypto market structure this cycle",
      "risk management and position sizing frameworks for small portfolios",
    ],
  },
  {
    operator: "content",
    domain: "content",
    fallback: ["short-form content formats that convert for performance coaches"],
  },
];

/** Resolve an operator's standing topics from Living Knowledge, else fallback. */
export async function resolveTopicsFor(operator: string, fallback: string[], key = "standing_topics"): Promise<string[]> {
  try {
    const operatorId = await resolveOperatorId(operator);
    if (!operatorId) return fallback;
    const entry = await getKnowledge(operatorId, "research", key);
    if (Array.isArray(entry?.value) && entry.value.every((t: any) => typeof t === "string") && entry.value.length > 0) {
      return entry.value as string[];
    }
  } catch (err) {
    console.warn(`[pulse] topics lookup failed for ${operator}, using defaults:`, err);
  }
  return fallback;
}

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
  // Resolve every lane's topics up front so the run row records the truth.
  const lanes: Array<{ operator: string; domain: string; topics: string[] }> = [];
  for (const sw of SWEEPS) {
    lanes.push({ operator: sw.operator, domain: sw.domain, topics: await resolveTopicsFor(sw.operator, sw.fallback) });
  }
  const allTopics = lanes.flatMap((l) => l.topics.map((t) => `${l.operator}: ${t}`));

  // Scoreboard row for the pass — the measurement plane sees every sweep.
  const run = await prisma.ingestionRun.create({
    data: {
      runType: "weekend_deep",
      operatorName: "all",
      triggeredBy: "schedule",
      sourcesQueried: allTopics,
    },
  });

  const results: Array<{ topic: string; insights: number; proposals: number; error?: string }> = [];

  for (const lane of lanes) {
    for (const topic of lane.topics) {
      try {
        const r = await runResearch({ query: topic, operator: lane.operator, depth: "medium" });
        results.push({
          topic: `${lane.operator}: ${topic}`,
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
            domain: lane.domain,
            operatorName: lane.operator,
            triggeredBy: "schedule",
          }).catch((err: any) =>
            console.warn("[pulse] corpus ingestion of findings failed (non-fatal):", err)
          );
        }
      } catch (err: any) {
        results.push({ topic: `${lane.operator}: ${topic}`, insights: 0, proposals: 0, error: err?.message ?? String(err) });
      }
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
