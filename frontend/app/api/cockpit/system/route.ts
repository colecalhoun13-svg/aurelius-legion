import { NextResponse } from "next/server";
import { prisma } from "../../../../../aurelius/core/db/prisma";

// Real telemetry — reads the same Postgres the backend writes.
export const dynamic = "force-dynamic";

import os from "os";

export async function GET() {
  try {
    const [running, pendingProposals, inbox, boot] = await Promise.all([
      prisma.mission.count({ where: { status: "running" } }),
      prisma.knowledgeProposal.count({ where: { status: "pending" } }),
      prisma.task.count({ where: { status: "inbox" } }),
      prisma.logEntry.findFirst({ where: { type: "boot" }, orderBy: { createdAt: "desc" } }),
    ]);
    return NextResponse.json({
      cpuLoad: Math.min(1, os.loadavg()[0] / os.cpus().length),
      memoryUsage: 1 - os.freemem() / os.totalmem(),
      activeTasks: running,
      queueDepth: pendingProposals + inbox,
      uptime: boot ? Math.floor((Date.now() - boot.createdAt.getTime()) / 1000) : 0,
      updatedAt: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json(null);
  }
}
