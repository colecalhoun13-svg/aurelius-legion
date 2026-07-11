import { NextResponse } from "next/server";
import { prisma } from "../../../../../aurelius/core/db/prisma";

// Real telemetry — reads the same Postgres the backend writes.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const since = new Date(Date.now() - 86400_000);
    const [llm, mems] = await Promise.all([
      prisma.logEntry.findMany({
        where: { type: "llm_call", createdAt: { gte: since } },
        select: { operator: { select: { name: true } } },
        take: 1000,
      }),
      prisma.memory.findMany({
        where: { createdAt: { gte: since } },
        select: { operator: { select: { name: true } } },
        take: 1000,
      }),
    ]);
    const byOp = new Map<string, number>();
    for (const r of [...llm, ...mems]) {
      const name = r.operator?.name ?? "unknown";
      byOp.set(name, (byOp.get(name) ?? 0) + 1);
    }
    const total = llm.length + mems.length || 1;
    const now = new Date().toISOString();
    return NextResponse.json(
      [...byOp.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([focusArea, n]) => ({ timestamp: now, focusArea, weight: n / total }))
    );
  } catch {
    return NextResponse.json([]);
  }
}
