import { NextResponse } from "next/server";

// THE SCOREBOARD FEED — everything the dashboards draw, one fetch:
// weekly measurement snapshots (follow-through, LLM dependence), raw
// completion timestamps (bucketed client-side in Cole's timezone, never
// the server's), habit dot-grids, goal pace inputs, the autonomy week,
// and corpus growth. DB-backed — never statically evaluate at build time.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { prisma } = await import("../../../../aurelius/core/db/prisma");
    const { listHabits, listGoals } = await import("../../../../aurelius/productivity/service");

    const now = Date.now();
    const d14 = new Date(now - 14 * 86400_000);
    const d7 = new Date(now - 7 * 86400_000);

    const [snaps, doneTasks, habits, completions, goals, acted7, undone7, pendingNow, corpusDates] =
      await Promise.all([
        prisma.measurementSnapshot.findMany({
          where: { operatorId: null },
          orderBy: { weekStart: "asc" },
          take: 26,
        }),
        prisma.task.findMany({
          where: { status: "done", completedAt: { gte: d14 } },
          select: { completedAt: true },
        }),
        listHabits(),
        prisma.habitCompletion.findMany({
          where: { completedAt: { gte: d14 } },
          select: { habitId: true, completedAt: true },
        }),
        listGoals(),
        prisma.bridgeSignal.count({ where: { status: "acted", createdAt: { gte: d7 } } }),
        prisma.bridgeSignal.count({ where: { status: "undone", createdAt: { gte: d7 } } }),
        prisma.bridgeSignal.count({ where: { status: { in: ["pending", "surfaced"] } } }),
        prisma.corpusDocument.findMany({ select: { createdAt: true }, orderBy: { createdAt: "asc" } }),
      ]);

    return NextResponse.json({
      weeks: snaps.map((s: any) => {
        const m = (s.metrics ?? {}) as Record<string, any>;
        return {
          weekStart: s.weekStart,
          followThrough: m.followThrough ?? null,
          tasksDone: m.tasksDone ?? 0,
          habitCompletions: m.habitCompletions ?? 0,
          llmDependenceRate: m.llmDependenceRate ?? null,
          corpusDocsAdded: m.corpusDocsAdded ?? 0,
          // The learning metrics (final council): computed every Sunday and
          // previously discarded right here at the API boundary.
          patternsActive: m.patternsActive ?? null,
          corrections: m.corrections ?? null,
          staleKnowledge: m.staleKnowledge ?? null,
        };
      }),
      doneTimestamps: doneTasks.map((t: any) => t.completedAt),
      habits,
      habitCompletions: completions,
      goals,
      autonomy: { acted7, undone7, pendingNow },
      corpusDates: corpusDates.map((c: any) => c.createdAt),
    });
  } catch (error: any) {
    console.error("Scoreboard API error:", error);
    return NextResponse.json({ error: error?.message ?? "Failed to load scoreboard" }, { status: 500 });
  }
}
