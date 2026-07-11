import { NextResponse } from "next/server";
import { prisma } from "../../../../../aurelius/core/db/prisma";

// Real telemetry — reads the same Postgres the backend writes.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await prisma.logEntry.findMany({
      where: { type: "llm_call", createdAt: { gte: new Date(Date.now() - 86400_000) } },
      select: { message: true },
      take: 1000,
    });
    const byEngine = new Map<string, number>();
    for (const r of rows) {
      const engine = r.message.split("/")[0];
      byEngine.set(engine, (byEngine.get(engine) ?? 0) + 1);
    }
    const total = rows.length || 1;
    return NextResponse.json(
      [...byEngine.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([engine, n]) => ({ engine, load: n / total }))
    );
  } catch {
    return NextResponse.json([]);
  }
}
