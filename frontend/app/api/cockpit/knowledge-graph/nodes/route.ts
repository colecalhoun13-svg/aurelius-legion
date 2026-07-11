import { NextResponse } from "next/server";
import { prisma } from "../../../../../../aurelius/core/db/prisma";

// Real telemetry — reads the same Postgres the backend writes.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const entries = await prisma.knowledgeEntry.findMany({
      where: { active: true },
      select: { scope: true, operator: { select: { name: true } } },
      take: 2000,
    });
    const ops = new Set<string>();
    const scopes = new Set<string>();
    for (const e of entries) {
      ops.add(e.operator?.name ?? "unknown");
      scopes.add(e.scope);
    }
    return NextResponse.json([
      ...[...ops].map((o) => ({ id: `op:${o}`, label: o, type: "operator" })),
      ...[...scopes].map((s) => ({ id: `scope:${s}`, label: s, type: "scope" })),
    ]);
  } catch {
    return NextResponse.json([]);
  }
}
