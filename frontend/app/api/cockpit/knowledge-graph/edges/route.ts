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
    const pairs = new Map<string, number>();
    for (const e of entries) {
      const k = `${e.operator?.name ?? "unknown"}→${e.scope}`;
      pairs.set(k, (pairs.get(k) ?? 0) + 1);
    }
    return NextResponse.json(
      [...pairs.entries()].map(([k, n]) => {
        const [op, scope] = k.split("→");
        return { id: k, from: `op:${op}`, to: `scope:${scope}`, label: `${n}` };
      })
    );
  } catch {
    return NextResponse.json([]);
  }
}
