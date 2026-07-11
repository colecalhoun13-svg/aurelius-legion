import { NextResponse } from "next/server";
import { prisma } from "../../../../../aurelius/core/db/prisma";

// Real telemetry — reads the same Postgres the backend writes.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const steps = await prisma.missionStep.findMany({
      orderBy: { createdAt: "desc" },
      take: 12,
      include: { mission: { select: { title: true } } },
    });
    return NextResponse.json(
      steps.map((s) => ({
        id: s.id,
        timestamp: (s.finishedAt ?? s.startedAt ?? s.createdAt).toISOString(),
        level: s.status === "failed" ? "error" : s.status === "done" ? "success" : "info",
        message: `${s.mission.title} — ${s.kind}: ${s.status}`,
        context: s.error ? { error: s.error } : undefined,
      }))
    );
  } catch {
    return NextResponse.json([]);
  }
}
