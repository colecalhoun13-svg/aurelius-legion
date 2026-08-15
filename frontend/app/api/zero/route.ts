import { NextResponse } from "next/server";
import { athleteZeroSummary, logSelfMetric, setSelfTarget } from "../../../../aurelius/athlete/self";
import { whoopStatus } from "../../../../aurelius/health/whoop";

export const dynamic = "force-dynamic";

// ATHLETE ZERO — Cole's own training picture (performance + dev curves +
// WHOOP readiness), kept separate from the athletes he coaches.
export async function GET() {
  try {
    const z = await athleteZeroSummary();
    return NextResponse.json({
      athlete: z.self.name,
      readiness: z.readiness,
      whoop: whoopStatus(),
      series: z.performance?.series ?? [],
      targets: z.performance?.targets ?? [],
      curves: z.curves?.curves ?? [],
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Failed to load Athlete Zero" }, { status: 500 });
  }
}

// Log Cole's own numbers / set his own targets — so Zero is a place he can PUT
// his training into, not just read it.
export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (body?.op === "log") {
      const res = await logSelfMetric({ label: body.label, value: Number(body.value), unit: body.unit });
      return res.ok ? NextResponse.json(res) : NextResponse.json({ error: res.error }, { status: 400 });
    }
    if (body?.op === "target") {
      const res = await setSelfTarget({ label: body.label, targetValue: Number(body.targetValue), unit: body.unit, targetDate: body.targetDate });
      return res.ok ? NextResponse.json(res) : NextResponse.json({ error: res.error }, { status: 400 });
    }
    return NextResponse.json({ error: "unknown zero write" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Zero write failed" }, { status: 500 });
  }
}
