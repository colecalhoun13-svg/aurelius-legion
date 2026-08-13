// aurelius/training/devCurves.ts
//
// LONG-TERM DEVELOPMENT CURVES (NORTH_STAR #14) — the question the raw series
// don't answer: not "how much has this athlete improved" but "where are they
// HEADING?" Fits a trend over each measure's history, projects it forward, and
// names the shape of the trajectory — accelerating, steady, plateauing, or
// sliding — so Cole can see a plateau forming before it costs a season.
//
// Built on athletePerformance (same buckets, same orientation) so a curve can
// never disagree with the trends panel it sits beside. Honest about confidence:
// a projection needs enough points over enough time; below that it says
// "insufficient" rather than drawing a confident line through two dots. It's an
// OBSERVATION (hard rule 5) — a projected trajectory, never a prescription; the
// programming call stays Cole's. Both athlete kinds (a curve is a coaching fact).

const PROJECT_DAYS = 90; // ~a training block out
const MIN_POINTS = 3;

export type DevCurve = {
  measure: string;
  unit: string | null;
  count: number;
  spanDays: number;
  latest: number;
  ratePerWeek: number | null; // oriented so + = getting better, in unit/week
  projected90d: number | null; // raw projected value ~90 days out (null if not enough signal)
  trajectory: "accelerating" | "steady" | "plateauing" | "declining" | "insufficient";
};

export type AthleteDevCurves = { clientId: string; athlete: string; curves: DevCurve[] };

/** Least-squares slope of value over time (raw units per DAY). */
function slopePerDay(pts: Array<{ x: number; y: number }>): number | null {
  const n = pts.length;
  if (n < 2) return null;
  const mx = pts.reduce((s, p) => s + p.x, 0) / n;
  const my = pts.reduce((s, p) => s + p.y, 0) / n;
  let num = 0;
  let den = 0;
  for (const p of pts) {
    num += (p.x - mx) * (p.y - my);
    den += (p.x - mx) * (p.x - mx);
  }
  if (den === 0) return null; // all same day → no slope
  return num / den;
}

export async function developmentCurves(clientId: string): Promise<AthleteDevCurves | null> {
  const { athletePerformance } = await import("../crm/performance.ts");
  const perf = await athletePerformance(clientId).catch(() => null);
  if (!perf) return null;

  const curves: DevCurve[] = [];
  for (const s of perf.series) {
    const pts = s.points.map((p) => ({ x: p.achievedAt.getTime() / 86400_000, y: p.value }));
    const spanDays = pts.length >= 2 ? Math.round(pts[pts.length - 1]!.x - pts[0]!.x) : 0;
    const base: DevCurve = {
      measure: s.label,
      unit: s.unit,
      count: s.count,
      spanDays,
      latest: s.latest.value,
      ratePerWeek: null,
      projected90d: null,
      trajectory: "insufficient",
    };

    // Need enough points over a real span to say anything about direction.
    if (pts.length < MIN_POINTS || spanDays < 14) {
      curves.push(base);
      continue;
    }

    const rawSlope = slopePerDay(pts);
    if (rawSlope == null) {
      curves.push(base);
      continue;
    }
    const orient = s.lowerIsBetter ? -1 : 1; // + rate always means "improving"
    base.ratePerWeek = Math.round(rawSlope * 7 * orient * 100) / 100;
    base.projected90d = Math.round((s.latest.value + rawSlope * PROJECT_DAYS) * 100) / 100;

    // Trajectory: compare the recent half's slope to the whole-history slope.
    const mid = Math.floor(pts.length / 2);
    const recentSlope = slopePerDay(pts.slice(mid));
    const overallOriented = rawSlope * orient;
    const recentOriented = recentSlope != null ? recentSlope * orient : overallOriented;
    // Thresholds relative to the measure's own scale, so "flat" means flat for
    // THIS lift, not an absolute number that only fits one unit.
    const scale = Math.max(Math.abs(s.best.value), 1);
    const flat = scale * 0.0005; // ~0.05%/day is effectively stalled
    if (overallOriented < -flat) base.trajectory = "declining";
    else if (recentOriented > overallOriented + flat && recentOriented > flat) base.trajectory = "accelerating";
    else if (overallOriented > flat && recentOriented < flat) base.trajectory = "plateauing";
    else if (overallOriented > flat) base.trajectory = "steady";
    else base.trajectory = "plateauing"; // overall flat, not declining → a plateau
    curves.push(base);
  }

  return { clientId, athlete: perf.name, curves };
}
