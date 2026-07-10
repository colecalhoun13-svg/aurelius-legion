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
    prisma.compiledPattern.count({ where: { status: { in: ["active", "proposed"] } } }),
    prisma.correction.count({ where: { createdAt: window } }),
    prisma.ritualInstance.count({ where: { firedAt: window } }),
    prisma.ingestionRun.count({ where: { startedAt: window, status: "completed" } }),
    prisma.mission.groupBy({
      by: ["status"],
      where: { createdAt: window },
      _count: { id: true },
    }),
  ]);

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
  };

  // Not an upsert: Prisma can't address a compound unique when a member is
  // NULL (operatorId null = the whole-system snapshot). Find-then-write.
  const existing = await prisma.measurementSnapshot.findFirst({
    where: { weekStart, operatorId: null },
  });
  const snapshot = existing
    ? await prisma.measurementSnapshot.update({ where: { id: existing.id }, data: { metrics } })
    : await prisma.measurementSnapshot.create({ data: { weekStart, metrics } });

  const week = weekStart.toISOString().slice(0, 10);
  const missionsRun = Object.values(missionCounts).reduce((s: number, n: any) => s + n, 0);
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
        corrections > 0 ? `${corrections} corrections logged — the trust loop is working.` : "",
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
