import { NextResponse } from "next/server";
import { prisma } from "../../../../../aurelius/core/db/prisma";

// Real telemetry — reads the same Postgres the backend writes.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const since = new Date(Date.now() - 7 * 86400_000);
    const rows = await prisma.logEntry.findMany({
      where: { type: "llm_call", createdAt: { gte: since } },
      select: { createdAt: true, context: true },
      take: 2000,
    });
    const byDay = new Map<string, { tokens: number; calls: number }>();
    for (const r of rows) {
      const day = r.createdAt.toISOString().slice(0, 10);
      const cur = byDay.get(day) ?? { tokens: 0, calls: 0 };
      cur.tokens += ((r.context ?? {}) as any).tokensUsed ?? 0;
      cur.calls += 1;
      byDay.set(day, cur);
    }
    return NextResponse.json(
      [...byDay.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([day, v]) => ({ timestamp: `${day}T00:00:00.000Z`, tokens: v.tokens, calls: v.calls }))
    );
  } catch {
    return NextResponse.json([]);
  }
}
