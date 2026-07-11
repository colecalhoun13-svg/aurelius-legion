import { NextResponse } from "next/server";
import { prisma } from "../../../../../aurelius/core/db/prisma";

// Real telemetry — reads the same Postgres the backend writes.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const snaps = await prisma.measurementSnapshot.findMany({
      orderBy: { weekStart: "asc" },
      take: 12,
    });
    return NextResponse.json(
      snaps
        // llmDependenceRate is an integer percent (0-100), null = no data yet
        .filter((s) => ((s.metrics ?? {}) as any).llmDependenceRate != null)
        .map((s) => ({
          timestamp: s.weekStart.toISOString(),
          load: ((s.metrics ?? {}) as any).llmDependenceRate / 100,
        }))
    );
  } catch {
    return NextResponse.json([]);
  }
}
