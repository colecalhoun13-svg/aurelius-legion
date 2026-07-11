import { NextResponse } from "next/server";
import { prisma } from "../../../../../aurelius/core/db/prisma";

// Real telemetry — reads the same Postgres the backend writes.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await prisma.logEntry.findMany({
      where: { type: "llm_call", createdAt: { gte: new Date(Date.now() - 7 * 86400_000) } },
      select: { message: true, context: true },
      take: 1000,
    });
    const agg = new Map<string, { sum: number; n: number }>();
    for (const r of rows) {
      const latency = ((r.context ?? {}) as any).latencyMs;
      if (typeof latency !== "number") continue;
      const cur = agg.get(r.message) ?? { sum: 0, n: 0 };
      cur.sum += latency;
      cur.n += 1;
      agg.set(r.message, cur);
    }
    return NextResponse.json(
      [...agg.entries()].map(([model, { sum, n }]) => ({ model, avgLatencyMs: Math.round(sum / n) }))
    );
  } catch {
    return NextResponse.json([]);
  }
}
