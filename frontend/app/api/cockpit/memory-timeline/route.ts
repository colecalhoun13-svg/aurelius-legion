import { NextResponse } from "next/server";
import { prisma } from "../../../../../aurelius/core/db/prisma";

// Real telemetry — reads the same Postgres the backend writes.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await prisma.memory.findMany({ orderBy: { createdAt: "desc" }, take: 14 });
    return NextResponse.json(
      rows.map((m) => ({
        id: m.id,
        timestamp: m.createdAt.toISOString(),
        event: m.value.slice(0, 90),
        category: m.category,
      }))
    );
  } catch {
    return NextResponse.json([]);
  }
}
