import { NextResponse } from "next/server";
import { prisma } from "../../../../../aurelius/core/db/prisma";

// Real telemetry — reads the same Postgres the backend writes.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [missionsRunning, missionsQueued, lastMission, lastRitual, lastIngest, tasksToday, tasksInbox, lastTask] =
      await Promise.all([
        prisma.mission.count({ where: { status: "running" } }),
        prisma.mission.count({ where: { status: { in: ["proposed", "planned"] } } }),
        prisma.mission.findFirst({ orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
        prisma.ritualInstance.findFirst({ orderBy: { firedAt: "desc" }, select: { firedAt: true } }),
        prisma.ingestionRun.findFirst({ orderBy: { startedAt: "desc" }, select: { startedAt: true } }),
        prisma.task.count({ where: { status: "today" } }),
        prisma.task.count({ where: { status: "inbox" } }),
        prisma.task.findFirst({ where: { status: "done" }, orderBy: { completedAt: "desc" }, select: { completedAt: true } }),
      ]);
    const iso = (d?: Date | null) => (d ? d.toISOString() : "");
    return NextResponse.json([
      { id: "missions", name: "Missions", activeTasks: missionsRunning, queuedTasks: missionsQueued, lastRun: iso(lastMission?.createdAt) },
      { id: "rituals", name: "Rituals", activeTasks: 0, queuedTasks: 0, lastRun: iso(lastRitual?.firedAt) },
      { id: "ingestion", name: "Ingestion", activeTasks: 0, queuedTasks: 0, lastRun: iso(lastIngest?.startedAt) },
      { id: "tasks", name: "Task plane", activeTasks: tasksToday, queuedTasks: tasksInbox, lastRun: iso(lastTask?.completedAt) },
    ]);
  } catch {
    return NextResponse.json([]);
  }
}
