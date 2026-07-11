import { NextResponse } from "next/server";
import { prisma } from "../../../../../aurelius/core/db/prisma";

// Real telemetry — reads the same Postgres the backend writes.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await prisma.memory.findMany({ orderBy: { updatedAt: "desc" }, take: 10 });
    return NextResponse.json(
      rows.map((m) => ({
        id: m.id,
        category: m.category,
        value: m.value.slice(0, 200),
        lastUpdated: m.updatedAt.toISOString(),
      }))
    );
  } catch {
    return NextResponse.json([]);
  }
}
