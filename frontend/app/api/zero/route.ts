import { NextResponse } from "next/server";
import { athleteZeroSummary } from "../../../../aurelius/athlete/self";
import { whoopStatus } from "../../../../aurelius/health/whoop";

export const dynamic = "force-dynamic";

// ATHLETE ZERO — Cole's own training picture (performance + dev curves +
// WHOOP readiness), kept separate from the athletes he coaches. Read-only.
export async function GET() {
  try {
    const z = await athleteZeroSummary();
    return NextResponse.json({
      athlete: z.self.name,
      readiness: z.readiness,
      whoop: whoopStatus(),
      series: z.performance?.series ?? [],
      curves: z.curves?.curves ?? [],
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Failed to load Athlete Zero" }, { status: 500 });
  }
}
