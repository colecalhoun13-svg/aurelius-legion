import { NextResponse } from "next/server";
import { athleteZeroSummary, logSelfMetric, setSelfTarget, linkSelfSheet } from "../../../../aurelius/athlete/self";
import { startExperiment, concludeExperiment, abandonExperiment } from "../../../../aurelius/athlete/experiments";
import { whoopStatus } from "../../../../aurelius/health/whoop";

export const dynamic = "force-dynamic";

// ATHLETE ZERO — Cole's own training picture (performance + dev curves +
// WHOOP readiness + n=1 experiments + his workout sheet), kept separate from
// the athletes he coaches.
export async function GET() {
  try {
    const z = await athleteZeroSummary();
    return NextResponse.json({
      athlete: z.self.name,
      readiness: z.readiness,
      whoop: whoopStatus(),
      sheetUrl: z.sheetUrl,
      series: z.performance?.series ?? [],
      targets: z.performance?.targets ?? [],
      curves: z.curves?.curves ?? [],
      experiments: z.experiments ?? [],
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Failed to load Athlete Zero" }, { status: 500 });
  }
}

// Log Cole's own numbers / set his own targets / link his workout sheet / run
// n=1 experiments — so Zero is a place he can PUT his training into, not just
// read it.
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
    if (body?.op === "sheet") {
      const res = await linkSelfSheet(String(body.url ?? ""));
      return res.ok ? NextResponse.json(res) : NextResponse.json({ error: res.error }, { status: 400 });
    }
    if (body?.op === "exp_start") {
      const res = await startExperiment({ hypothesis: body.hypothesis, metricLabel: body.metricLabel, protocol: body.protocol, endAt: body.endAt });
      return res.ok ? NextResponse.json(res) : NextResponse.json({ error: res.error }, { status: 400 });
    }
    if (body?.op === "exp_conclude") {
      const res = await concludeExperiment(String(body.id ?? ""));
      return res.ok ? NextResponse.json(res) : NextResponse.json({ error: res.error }, { status: 400 });
    }
    if (body?.op === "exp_abandon") {
      const res = await abandonExperiment(String(body.id ?? ""));
      return res.ok ? NextResponse.json(res) : NextResponse.json({ error: res.error }, { status: 400 });
    }
    return NextResponse.json({ error: "unknown zero write" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Zero write failed" }, { status: 500 });
  }
}
