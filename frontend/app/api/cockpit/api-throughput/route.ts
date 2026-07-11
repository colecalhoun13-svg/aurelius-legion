import { NextResponse } from "next/server";
import { prisma } from "../../../../../aurelius/core/db/prisma";

// Real telemetry — reads the same Postgres the backend writes.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const since = new Date(Date.now() - 12 * 3600_000);
    const rows = await prisma.logEntry.findMany({
      where: { type: "llm_call", createdAt: { gte: since } },
      select: { createdAt: true },
      take: 2000,
    });
    const buckets = new Map<string, number>();
    for (let h = 11; h >= 0; h--) {
      const t = new Date(Date.now() - h * 3600_000);
      t.setMinutes(0, 0, 0);
      buckets.set(t.toISOString(), 0);
    }
    for (const r of rows) {
      const t = new Date(r.createdAt);
      t.setMinutes(0, 0, 0);
      const k = t.toISOString();
      if (buckets.has(k)) buckets.set(k, (buckets.get(k) ?? 0) + 1);
    }
    return NextResponse.json(
      [...buckets.entries()].map(([timestamp, n]) => ({ timestamp, requestsPerMinute: +(n / 60).toFixed(3) }))
    );
  } catch {
    return NextResponse.json([]);
  }
}
