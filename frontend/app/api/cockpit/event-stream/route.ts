import { NextResponse } from "next/server";
import { prisma } from "../../../../../aurelius/core/db/prisma";

// Real telemetry — reads the same Postgres the backend writes.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await prisma.bridgeSignal.findMany({ orderBy: { createdAt: "desc" }, take: 12 });
    return NextResponse.json(
      rows.map((s) => ({
        id: s.id,
        timestamp: s.createdAt.toISOString(),
        channel: s.kind,
        message: s.title,
      }))
    );
  } catch {
    return NextResponse.json([]);
  }
}
