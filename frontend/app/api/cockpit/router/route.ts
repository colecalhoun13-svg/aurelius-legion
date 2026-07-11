import { NextResponse } from "next/server";
import { prisma } from "../../../../../aurelius/core/db/prisma";

// Real telemetry — reads the same Postgres the backend writes.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await prisma.logEntry.findMany({
      where: { type: "llm_call" },
      orderBy: { createdAt: "desc" },
      take: 12,
    });
    return NextResponse.json(
      rows.map((r) => {
        const ctx = (r.context ?? {}) as any;
        return {
          id: r.id,
          timestamp: r.createdAt.toISOString(),
          engine: r.message, // "engine/model" as logged by runLLM
          route: ctx.taskType ?? "chat",
          latencyMs: ctx.latencyMs ?? 0,
        };
      })
    );
  } catch {
    return NextResponse.json([]);
  }
}
