// aurelius/measurement/scoreboard.ts
//
// THE SCOREBOARD — one honest weekly snapshot of both lanes.
// Cole's lane: tasks, follow-through, habits. Aurelius's lane: what the
// brain absorbed, what missions ran, what compiled, what got corrected.
// Deterministic (no LLM). Fires Sunday evening; each snapshot upserts on
// (weekStart, operatorId) so a re-run refreshes rather than duplicates.

import { prisma } from "../core/db/prisma.ts";

/** Monday 00:00 UTC of the week containing `d` (calendar page convention). */
export function weekStartOf(d = new Date()): Date {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = date.getUTCDay(); // 0 Sun … 6 Sat
  const diff = day === 0 ? 6 : day - 1;
  date.setUTCDate(date.getUTCDate() - diff);
  return date;
}

export async function computeWeeklySnapshot(weekStartStr?: string) {
  const weekStart = weekStartStr ? new Date(`${weekStartStr}T00:00:00.000Z`) : weekStartOf();
  const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 3600 * 1000);
  const window = { gte: weekStart, lt: weekEnd };

  const [
    tasksDone,
    tasksCreated,
    habitCompletions,
    gaps,
    corpusDocs,
    memoriesWritten,
    reasoningRuns,
    patternsActive,
    corrections,
    ritualsFired,
    ingestionRuns,
    missions,
    llmCalls,
    cacheReuses,
    correctedReuses,
    earnedThisWeekAgg,
    earnedAllTimeAgg,
    leadsThisWeek,
  ] = await Promise.all([
    prisma.task.count({ where: { status: "done", completedAt: window } }),
    prisma.task.count({ where: { createdAt: window } }),
    prisma.habitCompletion.count({ where: { completedAt: window } }),
    prisma.intentActionGap.findMany({
      where: { windowStart: window },
      select: { gapScore: true },
    }),
    prisma.corpusDocument.findMany({
      where: { createdAt: window },
      select: { chunkCount: true },
    }),
    prisma.memory.count({ where: { createdAt: window } }),
    prisma.reasoningCacheEntry.count({ where: { createdAt: window } }),
    prisma.compiledPattern.count({ where: { status: { not: "discarded" } } }),
    prisma.correction.count({ where: { createdAt: window } }),
    prisma.ritualInstance.count({ where: { firedAt: window } }),
    prisma.ingestionRun.count({ where: { startedAt: window, status: "completed" } }),
    prisma.mission.groupBy({
      by: ["status"],
      where: { createdAt: window },
      _count: { id: true },
    }),
    prisma.logEntry.count({ where: { type: "llm_call", createdAt: window } }),
    // Compiled entries REUSED this week (created earlier, touched now) —
    // the numerator of independence. A reuse Cole later CORRECTED is excluded:
    // a wrong reuse must not read as independence (3.6). The corrected count is
    // surfaced separately so a metric falling while corrections climb is visible.
    prisma.reasoningCacheEntry.count({
      where: { updatedAt: window, createdAt: { lt: weekStart }, correctedAt: null },
    }),
    prisma.reasoningCacheEntry.count({
      where: { updatedAt: window, createdAt: { lt: weekStart }, correctedAt: { not: null } },
    }),
    // MONEY. Earned = payments that arrived (real), split this-week vs all-time.
    // Leads created is the pipeline motion — deliberately a DIFFERENT number, so
    // "drafted" (a lead, a pipeline entry) is never read as "paid" (money in).
    prisma.payment.aggregate({ where: { receivedAt: window }, _sum: { amountCents: true } }),
    prisma.payment.aggregate({ _sum: { amountCents: true } }),
    prisma.lead.count({ where: { createdAt: window } }),
  ]);

  // Freshness plane — how much of Living Knowledge is past its half-life.
  const { listStaleEntries } = await import("../knowledge/freshness.ts");
  const staleKnowledge = (await listStaleEntries()).length;

  const avgGap = gaps.length
    ? gaps.reduce((s, g) => s + g.gapScore, 0) / gaps.length
    : null;
  const missionCounts = Object.fromEntries(missions.map((m) => [m.status, m._count.id]));

  const metrics = {
    // Cole's lane
    tasksDone,
    tasksCreated,
    habitCompletions,
    followThrough: avgGap !== null ? Math.round((1 - avgGap) * 100) : null,
    daysMeasured: gaps.length,
    // Aurelius's lane
    corpusDocsAdded: corpusDocs.length,
    chunksAdded: corpusDocs.reduce((s, d) => s + d.chunkCount, 0),
    memoriesWritten,
    reasoningRuns,
    patternsActive,
    ritualsFired,
    ingestionRuns,
    missions: missionCounts,
    // Trust loop — corrections are signal, not failure
    corrections,
    staleKnowledge,
    // Money — earned is real (arrived), leads is motion. Kept distinct so the
    // scoreboard can never let a busy pipeline read as a paid one.
    earnedThisWeekCents: earnedThisWeekAgg._sum.amountCents ?? 0,
    earnedAllTimeCents: earnedAllTimeAgg._sum.amountCents ?? 0,
    leadsThisWeek,
    // The DoD metric: share of reasoning that still needed the base LLM.
    // Falls as compiled understanding takes over. null until there's data.
    llmCalls,
    cacheReuses,
    llmDependenceRate:
      llmCalls + cacheReuses > 0
        ? Math.round((llmCalls / (llmCalls + cacheReuses)) * 100)
        : null,
    // Of reuses served this week, the share Cole later corrected. The honesty
    // check on independence: a falling dependence rate ALONGSIDE a rising
    // correction rate is compiled understanding getting confidently wrong, not
    // getting better. Integer percent, null until there are reuses to judge.
    reuseCorrectionRate:
      cacheReuses + correctedReuses > 0
        ? Math.round((correctedReuses / (cacheReuses + correctedReuses)) * 100)
        : null,
  };

  // Not an upsert: Prisma can't address a compound unique when a member is
  // NULL (operatorId null = the whole-system snapshot). Find-then-write,
  // backstopped by the partial unique index (migration
  // job_claims_and_snapshot_dedup) — a concurrent creator loses with P2002
  // and we fall through to update the winner's row.
  const existing = await prisma.measurementSnapshot.findFirst({
    where: { weekStart, operatorId: null },
  });
  let snapshot;
  if (existing) {
    snapshot = await prisma.measurementSnapshot.update({ where: { id: existing.id }, data: { metrics } });
  } else {
    try {
      snapshot = await prisma.measurementSnapshot.create({ data: { weekStart, metrics } });
    } catch (err: any) {
      if (err?.code !== "P2002") throw err;
      // A concurrent run won the create — update its row instead.
      const winner = await prisma.measurementSnapshot.findFirst({ where: { weekStart, operatorId: null } });
      if (!winner) throw err;
      snapshot = await prisma.measurementSnapshot.update({ where: { id: winner.id }, data: { metrics } });
    }
  }

  const week = weekStart.toISOString().slice(0, 10);
  const missionsRun = Object.values(missionCounts).reduce((s: number, n: any) => s + n, 0);

  // The flywheel push (council PR4): earned-trust suggestions ride the weekly
  // scoreboard — deduped by the shared cooldown so this never becomes a nag.
  let suggestionLines: string[] = [];
  try {
    const { freshGrantSuggestions, markSuggestionsSurfaced } = await import("../autonomy/trustLedger.ts");
    const sugg = await freshGrantSuggestions();
    if (sugg.length > 0) {
      suggestionLines = ["", "Worth handing over (Aurelius → Autonomy, one tap):", ...sugg.map((s) => `♛ ${s.reason}`)];
      await markSuggestionsSurfaced(sugg);
    }
  } catch (err) {
    console.warn("[scoreboard] grant suggestions skipped:", (err as any)?.message ?? err);
  }

  await prisma.bridgeSignal.create({
    data: {
      kind: "background_result",
      domain: "personal",
      sourceType: "ritual",
      sourceId: snapshot.id,
      severity: "notice",
      title: `Weekly scoreboard — ${tasksDone} done, follow-through ${metrics.followThrough ?? "—"}%`,
      body: [
        `**Week of ${week}**`,
        `Your lane: ${tasksDone} tasks done (${tasksCreated} created) · ${habitCompletions} habit completions · follow-through ${metrics.followThrough ?? "n/a"}% over ${gaps.length} measured days`,
        `Aurelius's lane: ${corpusDocs.length} documents absorbed · ${memoriesWritten} memories · ${missionsRun} missions · ${ritualsFired} rituals fired`,
        metrics.llmDependenceRate !== null
          ? `LLM dependence: ${metrics.llmDependenceRate}% (${llmCalls} LLM calls vs ${cacheReuses} compiled reuses) — lower is smarter.`
          : "",
        corrections > 0 ? `${corrections} corrections logged — the trust loop is working.` : "",
        staleKnowledge > 0 ? `${staleKnowledge} knowledge entries past their half-life — re-checks queue Sundays.` : "",
        ...suggestionLines,
      ]
        .filter(Boolean)
        .join("\n"),
    },
  });

  console.log(`[scoreboard] week ${week}: ${tasksDone} done, ft=${metrics.followThrough}`);
  return snapshot;
}

export async function listSnapshots(limit = 12) {
  return prisma.measurementSnapshot.findMany({
    orderBy: { weekStart: "desc" },
    take: limit,
  });
}
