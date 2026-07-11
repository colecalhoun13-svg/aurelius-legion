import { NextResponse } from "next/server";
import { prisma } from "../../../../../aurelius/core/db/prisma";

// Real telemetry — reads the same Postgres the backend writes.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await prisma.logEntry.findMany({
      where: { level: "error", createdAt: { gte: new Date(Date.now() - 7 * 86400_000) } },
      select: { message: true, context: true },
      take: 500,
    });
    const byArea = new Map<string, number>();
    for (const r of rows) {
      const ctx = (r.context ?? {}) as any;
      const area = ctx.name ?? r.message.split(":")[0] ?? "unknown";
      byArea.set(area, (byArea.get(area) ?? 0) + 1);
    }
    return NextResponse.json([...byArea.entries()].map(([area, count]) => ({ area, count })));
  } catch {
    return NextResponse.json([]);
  }
}
