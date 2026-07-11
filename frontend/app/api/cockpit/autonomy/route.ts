import { NextResponse } from "next/server";
import { prisma } from "../../../../../aurelius/core/db/prisma";

// Real telemetry — reads the same Postgres the backend writes.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await prisma.logEntry.findMany({
      where: { type: { in: ["trace", "boot"] } },
      orderBy: { createdAt: "desc" },
      take: 14,
    });
    return NextResponse.json(
      rows.map((r) => {
        const ctx = (r.context ?? {}) as any;
        return {
          id: r.id,
          timestamp: r.createdAt.toISOString(),
          type: r.level === "error" ? "error" : ctx.kind === "schedule" ? "action" : "decision",
          summary: r.message,
          details: ctx.status
            ? `${ctx.status}${ctx.durationMs != null ? ` in ${ctx.durationMs}ms` : ""}${ctx.error ? ` — ${ctx.error}` : ""}`
            : undefined,
          metadata: ctx,
        };
      })
    );
  } catch {
    return NextResponse.json([]);
  }
}
