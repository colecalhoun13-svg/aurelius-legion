import { NextResponse } from "next/server";

// DB-backed — always live.
export const dynamic = "force-dynamic";

// GET → each field's shelf (read/total/discovered/cycles) + the most-recently
// studied units, so Cole can watch the shelves fill.
export async function GET() {
  try {
    const { getCurriculumProgress } = await import("../../../../aurelius/learning/curriculum");
    const { prisma } = await import("../../../../aurelius/core/db/prisma");
    const progress = await getCurriculumProgress();
    const recentDocs = await prisma.corpusDocument.findMany({
      where: { title: { startsWith: "Curriculum · " } },
      orderBy: { createdAt: "desc" },
      take: 12,
      select: { id: true, title: true, domain: true, createdAt: true },
    });
    const recent = recentDocs.map((d: any) => ({
      id: d.id,
      title: d.title.replace(/^Curriculum · /, ""),
      domain: d.domain,
      createdAt: d.createdAt,
    }));
    return NextResponse.json({ progress, recent });
  } catch (error: any) {
    console.error("Library API error:", error);
    return NextResponse.json({ error: error?.message ?? "failed to load library" }, { status: 500 });
  }
}

// POST { domain } → study that field's next unit now (Cole steering the reading).
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const domain = body?.domain ? String(body.domain) : undefined;
    const { runCurriculumIngest } = await import("../../../../aurelius/learning/curriculum");
    const res = await runCurriculumIngest({ onlyDomain: domain, maxUnits: 1 });
    return NextResponse.json(res, { status: res.ok ? 200 : 400 });
  } catch (error: any) {
    console.error("Library study error:", error);
    return NextResponse.json({ error: error?.message ?? "study failed" }, { status: 500 });
  }
}
