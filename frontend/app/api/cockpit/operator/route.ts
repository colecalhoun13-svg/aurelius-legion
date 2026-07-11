import { NextResponse } from "next/server";
import { prisma } from "../../../../../aurelius/core/db/prisma";

// Real telemetry — reads the same Postgres the backend writes.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const hourAgo = new Date(Date.now() - 3600_000);
    const [running, lastLlm, llmHour, lastLog, boot] = await Promise.all([
      prisma.mission.count({ where: { status: "running" } }),
      prisma.logEntry.findFirst({ where: { type: "llm_call" }, orderBy: { createdAt: "desc" } }),
      prisma.logEntry.count({ where: { type: "llm_call", createdAt: { gte: hourAgo } } }),
      prisma.logEntry.findFirst({ orderBy: { createdAt: "desc" } }),
      prisma.logEntry.findFirst({ where: { type: "boot" }, orderBy: { createdAt: "desc" } }),
    ]);
    const thinking = lastLlm && Date.now() - lastLlm.createdAt.getTime() < 10 * 60_000;
    return NextResponse.json({
      id: "aurelius",
      mode: running > 0 ? "executing" : thinking ? "thinking" : "idle",
      uptime: boot ? Math.floor((Date.now() - boot.createdAt.getTime()) / 1000) : 0,
      load: Math.min(1, llmHour / 30),
      lastAction: lastLog?.message ?? "(no activity logged yet)",
      updatedAt: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json(null);
  }
}
