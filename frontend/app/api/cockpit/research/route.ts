import { NextResponse } from "next/server";
import { prisma } from "../../../../../aurelius/core/db/prisma";

// Real telemetry — reads the same Postgres the backend writes.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const docs = await prisma.corpusDocument.findMany({
      where: { sourceType: "research" },
      orderBy: { createdAt: "desc" },
      take: 8,
    });
    return NextResponse.json(
      docs.map((d) => ({
        id: d.id,
        timestamp: d.createdAt.toISOString(),
        topic: d.title,
        insight: d.summary.slice(0, 300),
        confidence: 1, // ingested = confirmed in the corpus; no invented scores
        source: d.domain,
      }))
    );
  } catch {
    return NextResponse.json([]);
  }
}
