import { NextResponse } from "next/server";

// THE SPINE-HEALTH FEED (final council): the JobRun claim table — built to
// prevent double-fires — doubles as the flight recorder. Seven local days ×
// every claimed job, so "did my exocortex run last night?" is one glance,
// not a scroll through raw traces. Day keys use AURELIUS_TZ explicitly:
// this route runs in the FRONTEND container, which is a different process
// from the backend claim writer — both services must set the same
// TZ/AURELIUS_TZ (runbook) or evening columns would skew (post-sweep).
export const dynamic = "force-dynamic";

// Sunday-only jobs (the weekly learning cycle) — the strip renders their
// empty weekday cells as "not scheduled", not "missed". Mirrors the cron
// roster in aurelius/index.ts.
const WEEKLY = [
  "weekend_pulse",
  "persona_observer",
  "weekly_planning",
  "freshness_sweep",
  "capability_gaps",
  "weekly_scoreboard",
  "decision_curriculum",
  "curriculum_ingest",
];

export async function GET() {
  try {
    const { prisma } = await import("../../../../aurelius/core/db/prisma");
    const { ONCE_PER_DAY } = await import("../../../../aurelius/core/schedule");

    // Last 7 local day-keys, oldest first. Calendar-stepped (not 86400s
    // arithmetic — DST fall-back would duplicate a key) and pinned to
    // AURELIUS_TZ so both containers agree.
    const tz = process.env.AURELIUS_TZ?.trim() || undefined;
    const days: string[] = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return d.toLocaleDateString("en-CA", { timeZone: tz });
    });

    const runs = await prisma.jobRun.findMany({
      where: { day: { in: days } },
      select: { jobName: true, day: true, status: true },
    });

    const jobs = [...ONCE_PER_DAY];
    return NextResponse.json({
      days,
      jobs: jobs.map((name: string) => ({ name, weekly: WEEKLY.includes(name) })),
      runs,
    });
  } catch (error: any) {
    console.error("Spine feed error:", error);
    return NextResponse.json({ error: error?.message ?? "Failed to load spine health" }, { status: 500 });
  }
}
