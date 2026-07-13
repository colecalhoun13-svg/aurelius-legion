import { NextResponse } from "next/server";
import { prisma } from "../../../../../aurelius/core/db/prisma";

// Real telemetry — reads the same Postgres the backend writes.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Scheduled/catch-up runs now leave a "started" marker AND a completion row
    // (started marker makes in-flight jobs visible to catch-up). Hide the started
    // markers here so the feed shows one line per run, not two — fetch extra then
    // filter, so we still land 14 real rows.
    const raw = await prisma.logEntry.findMany({
      where: { type: { in: ["trace", "boot"] } },
      orderBy: { createdAt: "desc" },
      take: 28,
    });
    const rows = raw.filter((r) => ((r.context ?? {}) as any).status !== "started").slice(0, 14);
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
