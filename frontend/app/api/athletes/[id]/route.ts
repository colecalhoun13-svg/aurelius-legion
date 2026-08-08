import { NextResponse } from "next/server";
import { athletePerformance } from "../../../../../aurelius/crm/performance";

// One athlete's full performance view — identity, per-metric time series
// (trend lines, not adjectives), and the PR ledger. Read-only by design;
// writes go through /api/athletes (add/promote) and /api/crm/retention (log).
// DB-backed — never statically evaluate at build time.
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const view = await athletePerformance(params.id);
    if (!view) return NextResponse.json({ error: "no such athlete" }, { status: 404 });
    return NextResponse.json(view);
  } catch (error: any) {
    console.error("Athlete performance API error:", error);
    return NextResponse.json({ error: error?.message ?? "Failed to load the athlete" }, { status: 500 });
  }
}
