import { NextResponse } from "next/server";
import { prisma } from "../../../../../aurelius/core/db/prisma";

// Real telemetry — reads the same Postgres the backend writes.
export const dynamic = "force-dynamic";

const PHASE: Record<string, string> = {
  recall: "perception",
  research: "perception",
  synthesize: "action",
  report: "reflection",
};

export async function GET() {
  try {
    const mission = await prisma.mission.findFirst({
      where: { status: { in: ["running", "completed", "failed"] } },
      orderBy: { createdAt: "desc" },
      include: { steps: { orderBy: { idx: "asc" } } },
    });
    if (!mission) return NextResponse.json([]);
    const out = [
      {
        id: `${mission.id}-plan`,
        timestamp: mission.createdAt.toISOString(),
        phase: "planning",
        description: mission.planSummary ?? mission.objective.slice(0, 120),
      },
      ...mission.steps.map((s) => ({
        id: s.id,
        timestamp: (s.finishedAt ?? s.startedAt ?? s.createdAt).toISOString(),
        phase: PHASE[s.kind] ?? "action",
        description: `${s.kind}: ${s.input.slice(0, 100)} (${s.status})`,
      })),
    ];
    return NextResponse.json(out);
  } catch {
    return NextResponse.json([]);
  }
}
