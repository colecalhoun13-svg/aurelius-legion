import { NextResponse } from "next/server";
import { prisma } from "../../../../../aurelius/core/db/prisma";

// Real telemetry — reads the same Postgres the backend writes.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const groups = await prisma.vectorEmbedding.groupBy({
      by: ["sourceType"],
      _count: { _all: true },
    });
    return NextResponse.json(
      groups
        .sort((a, b) => b._count._all - a._count._all)
        .map((g) => ({ id: g.sourceType, label: g.sourceType, count: g._count._all }))
    );
  } catch {
    return NextResponse.json([]);
  }
}
