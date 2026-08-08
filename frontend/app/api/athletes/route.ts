import { NextResponse } from "next/server";
import { prisma } from "../../../../aurelius/core/db/prisma";

// The Athletes roster — every client plus their metric/PR counts, in one
// round trip. Thin and read-only: per-client detail (the retention view) and
// the log-a-metric write both go through the existing /api/crm/retention.
// DB-backed — never statically evaluate at build time.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [clients, metricCounts, prCounts] = await Promise.all([
      prisma.client.findMany({
        select: { id: true, name: true, sport: true },
        orderBy: { startedAt: "asc" },
      }),
      prisma.metric.groupBy({ by: ["clientId"], _count: { _all: true } }),
      prisma.metric.groupBy({ by: ["clientId"], _count: { _all: true }, where: { isPR: true } }),
    ]);
    const metricsBy = new Map(metricCounts.map((m) => [m.clientId, m._count._all]));
    const prsBy = new Map(prCounts.map((m) => [m.clientId, m._count._all]));
    return NextResponse.json({
      athletes: clients.map((c) => ({
        id: c.id,
        name: c.name,
        sport: c.sport,
        prCount: prsBy.get(c.id) ?? 0,
        metricCount: metricsBy.get(c.id) ?? 0,
      })),
    });
  } catch (error: any) {
    console.error("Athletes API error:", error);
    return NextResponse.json({ error: error?.message ?? "Failed to load athletes" }, { status: 500 });
  }
}
