// aurelius/crm/performance.ts
//
// THE PERFORMANCE VIEW — what the Athletes page (and chat) reads. One athlete's
// numbers, grouped by what was measured, each with its full time series so a
// trend is a drawn line, not an adjective. Serves BOTH kinds — a paying client
// and a training-only athlete get the same coaching surface; the gym boundary
// lives in the business machinery, not here. Read-only by design.

import { prisma } from "../core/db/prisma.ts";
import { lowerIsBetter } from "./retention.ts";

export type MetricSeries = {
  label: string; // display label (most recent casing wins)
  unit: string | null;
  lowerIsBetter: boolean;
  count: number;
  latest: { value: number; achievedAt: Date };
  best: { value: number; achievedAt: Date };
  first: { value: number; achievedAt: Date };
  // Signed % change from first recorded value to latest, oriented so that
  // POSITIVE always means "got better" (a faster 40 is positive). Null when
  // the first value is 0 (division) or there's only one point (no trend yet).
  improvementPct: number | null;
  prCount: number;
  points: Array<{ value: number; isPR: boolean; achievedAt: Date }>;
  // Momentum flags (also what the Monday trend sweep fires on — computed HERE
  // so the page tag and the signal can never disagree).
  stalled: boolean; // ≥4 points, still training it, best untouched ≥28 days
  regressing: boolean; // last 3 entries each worse than the one before
  streak: number; // trailing run of strictly-better entries (0 when < 2)
  // value ÷ latest bodyweight, when a same-unit bodyweight series exists.
  relative: number | null;
};

/** Momentum for one time-ordered bucket. Exported for the trend sweep. */
export function seriesMomentum(
  points: Array<{ value: number; achievedAt: Date }>,
  lower: boolean
): { stalled: boolean; regressing: boolean; streak: number } {
  const better = (a: number, b: number) => (lower ? a < b : a > b); // a beats b
  let streak = 0;
  for (let i = points.length - 1; i > 0; i--) {
    if (better(points[i]!.value, points[i - 1]!.value)) streak++;
    else break;
  }
  const regressing =
    points.length >= 3 &&
    [1, 2].every((k) => {
      const i = points.length - k;
      return better(points[i - 1]!.value, points[i]!.value);
    });
  // Stalled: enough history to mean something (≥4 entries), the best is ≥28
  // days old, and they've logged ≥2 entries SINCE it — still training the
  // lift, not moving. An athlete who simply stopped logging isn't "stalled".
  let stalled = false;
  if (points.length >= 4) {
    let bestIdx = 0;
    for (let i = 1; i < points.length; i++) {
      if (better(points[i]!.value, points[bestIdx]!.value)) bestIdx = i;
    }
    const sinceBest = points.length - 1 - bestIdx;
    const bestAgeDays = (points[points.length - 1]!.achievedAt.getTime() - points[bestIdx]!.achievedAt.getTime()) / 86400_000;
    stalled = sinceBest >= 2 && bestAgeDays >= 28 && !regressing;
  }
  return { stalled, regressing, streak: streak >= 2 ? streak + 1 : 0 };
}

export type TargetView = {
  id: string;
  label: string;
  unit: string | null;
  targetValue: number;
  targetDate: Date | null;
  note: string | null;
  achievedAt: Date | null;
  // Derived at read time, never stored. "no_data" = no matching series yet.
  pace: "achieved" | "ahead" | "on_pace" | "behind" | "past_due" | "open" | "no_data";
  latestValue: number | null;
  remaining: number | null; // distance to target, in the measure's own units
};

export type AthletePerformance = {
  id: string;
  name: string;
  kind: string;
  status: string;
  sport: string | null;
  position: string | null;
  gradYear: number | null;
  isMinor: boolean;
  notes: string | null;
  sheetUrl: string | null;
  lastLoggedAt: Date | null;
  prCount: number;
  series: MetricSeries[];
  recentPRs: Array<{ label: string; value: number; unit: string | null; achievedAt: Date }>;
  targets: TargetView[];
  sessions: Array<{ id: string; kind: string; happenedAt: Date | null; durationMin: number | null; notes: string | null }>;
};

const BODYWEIGHT_LABEL = /^(body\s*weight|bw|bodyweight)$/i;

/** Pace verdict for one target against its matching series (same label+unit).
 *  Exported for the trend sweep and the logMetric crossing check. */
export function targetPace(
  target: { label: string; unit: string | null; targetValue: number; targetDate: Date | null; achievedAt: Date | null },
  series: MetricSeries | undefined,
  now = new Date()
): { pace: TargetView["pace"]; latestValue: number | null; remaining: number | null } {
  if (target.achievedAt) return { pace: "achieved", latestValue: series?.latest.value ?? null, remaining: 0 };
  if (!series) return { pace: "no_data", latestValue: null, remaining: null };
  const lower = lowerIsBetter(target.label);
  const latest = series.latest.value;
  const reached = lower ? latest <= target.targetValue : latest >= target.targetValue;
  const remaining = Math.round(Math.abs(target.targetValue - latest) * 100) / 100;
  if (reached) return { pace: "achieved", latestValue: latest, remaining: 0 };
  if (!target.targetDate) return { pace: "open", latestValue: latest, remaining };
  const daysLeft = (target.targetDate.getTime() - now.getTime()) / 86400_000;
  if (daysLeft <= 0) return { pace: "past_due", latestValue: latest, remaining };
  if (series.count < 2) return { pace: "open", latestValue: latest, remaining }; // one point is not a rate
  // Observed rate: progress per day over the trailing 60 days (whole series if
  // shorter), oriented so positive = toward the target.
  const cutoff = now.getTime() - 60 * 86400_000;
  const window = series.points.filter((p) => p.achievedAt.getTime() >= cutoff);
  const span = window.length >= 2 ? window : series.points;
  const t0 = span[0]!, t1 = span[span.length - 1]!;
  const days = Math.max((t1.achievedAt.getTime() - t0.achievedAt.getTime()) / 86400_000, 1);
  const rawRate = (t1.value - t0.value) / days;
  const observed = lower ? -rawRate : rawRate; // per-day progress toward better
  const required = remaining / daysLeft;
  if (observed <= 0) return { pace: "behind", latestValue: latest, remaining };
  const ratio = observed / required;
  return { pace: ratio >= 1.1 ? "ahead" : ratio >= 0.75 ? "on_pace" : "behind", latestValue: latest, remaining };
}

/** Everything the per-athlete panel needs, in one read. Null → no such athlete. */
export async function athletePerformance(clientId: string): Promise<AthletePerformance | null> {
  const [client, metrics, targets, sessions] = await Promise.all([
    prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true, name: true, kind: true, status: true, sport: true, position: true, gradYear: true, isMinor: true, notes: true, sheetUrl: true },
    }),
    prisma.metric.findMany({
      where: { clientId },
      // Secondary key (council catch): bulk session logging can land identical
      // achievedAt timestamps, and a tie leaves row order unspecified — latest
      // value/casing/unit would flip between page loads.
      orderBy: [{ achievedAt: "asc" }, { createdAt: "asc" }],
      select: { label: true, value: true, unit: true, isPR: true, achievedAt: true },
    }),
    prisma.athleteTarget.findMany({ where: { clientId }, orderBy: [{ achievedAt: "asc" }, { targetDate: "asc" }, { createdAt: "asc" }] }),
    prisma.session.findMany({
      where: { clientId },
      orderBy: [{ completedAt: "desc" }, { scheduledAt: "desc" }],
      take: 12,
      select: { id: true, kind: true, scheduledAt: true, completedAt: true, durationMin: true, notes: true },
    }),
  ]);
  if (!client) return null;

  // Group case-insensitively — "Squat" and "squat" are the same lift — but
  // display whatever casing was logged most recently. Group by UNIT too
  // (council catch): "squat 100 kg" then "squat 185 lbs" in one bucket would
  // render 185 as the best and +85% as improvement — a false green arrow. Two
  // units = two honest series; the page shows the unit beside each label.
  const byLabel = new Map<string, typeof metrics>();
  for (const m of metrics) {
    const key = `${m.label.trim().toLowerCase()}|${(m.unit ?? "").trim().toLowerCase()}`;
    const bucket = byLabel.get(key);
    if (bucket) bucket.push(m);
    else byLabel.set(key, [m]);
  }

  // Latest bodyweight per unit — powers relative strength (value ÷ BW) for
  // same-unit strength series. Unit-matched so kg never divides lbs.
  const bwByUnit = new Map<string, number>();
  for (const m of metrics) {
    if (BODYWEIGHT_LABEL.test(m.label.trim())) bwByUnit.set((m.unit ?? "").trim().toLowerCase(), m.value);
  }

  const series: MetricSeries[] = [];
  for (const bucket of byLabel.values()) {
    const latest = bucket[bucket.length - 1]!;
    const first = bucket[0]!;
    const lower = lowerIsBetter(latest.label);
    const best = bucket.reduce((b, m) => (lower ? (m.value < b.value ? m : b) : m.value > b.value ? m : b));
    const rawPct = first.value !== 0 && bucket.length > 1 ? ((latest.value - first.value) / Math.abs(first.value)) * 100 : null;
    const momentum = seriesMomentum(bucket, lower);
    const unitKey = (latest.unit ?? first.unit ?? "").trim().toLowerCase();
    const bw = bwByUnit.get(unitKey);
    const isBodyweight = BODYWEIGHT_LABEL.test(latest.label.trim());
    series.push({
      label: latest.label,
      unit: latest.unit ?? first.unit ?? null,
      lowerIsBetter: lower,
      count: bucket.length,
      latest: { value: latest.value, achievedAt: latest.achievedAt },
      best: { value: best.value, achievedAt: best.achievedAt },
      first: { value: first.value, achievedAt: first.achievedAt },
      improvementPct: rawPct == null ? null : Math.round((lower ? -rawPct : rawPct) * 10) / 10,
      prCount: bucket.filter((m) => m.isPR).length,
      points: bucket.map((m) => ({ value: m.value, isPR: m.isPR, achievedAt: m.achievedAt })),
      ...momentum,
      // Relative strength only where it means something: an upward, weight-
      // unit measure that isn't bodyweight itself.
      relative: !isBodyweight && !lower && bw && bw > 0 && /^(lbs?|kgs?|kilos?|pounds?)$/.test(unitKey)
        ? Math.round((latest.value / bw) * 100) / 100
        : null,
    });
  }
  // Most-recently-trained first — the lift you're working on tops the panel.
  series.sort((a, b) => b.latest.achievedAt.getTime() - a.latest.achievedAt.getTime());

  const seriesByKey = new Map(series.map((s) => [`${s.label.trim().toLowerCase()}|${(s.unit ?? "").trim().toLowerCase()}`, s]));
  const targetViews: TargetView[] = targets.map((t) => {
    const s = seriesByKey.get(`${t.label.trim().toLowerCase()}|${(t.unit ?? "").trim().toLowerCase()}`);
    const p = targetPace(t, s);
    return {
      id: t.id,
      label: t.label,
      unit: t.unit,
      targetValue: t.targetValue,
      targetDate: t.targetDate,
      note: t.note,
      achievedAt: t.achievedAt,
      ...p,
    };
  });

  const prs = metrics.filter((m) => m.isPR);
  return {
    ...client,
    lastLoggedAt: metrics.length ? metrics[metrics.length - 1]!.achievedAt : null,
    prCount: prs.length,
    series,
    recentPRs: prs
      .slice(-10)
      .reverse()
      .map((m) => ({ label: m.label, value: m.value, unit: m.unit ?? null, achievedAt: m.achievedAt })),
    targets: targetViews,
    sessions: sessions.map((s) => ({
      id: s.id,
      kind: s.kind,
      happenedAt: s.completedAt ?? s.scheduledAt,
      durationMin: s.durationMin,
      notes: s.notes,
    })),
  };
}

/** Resolve an athlete's program sheet: the stored URL wins; otherwise, when
 *  Google auth is live, search Cole's Drive by athlete name (the adapter's
 *  existing matcher — exact beats prefix, ambiguity refuses to guess) and
 *  REMEMBER the hit. Dormant-honest: no auth → a reason, never a fake link. */
export async function resolveAthleteSheet(clientId: string): Promise<{ url: string | null; found?: string; reason?: string }> {
  const client = await prisma.client.findUnique({ where: { id: clientId }, select: { id: true, name: true, sheetUrl: true } });
  if (!client) throw new Error("No client with that id.");
  if (client.sheetUrl) return { url: client.sheetUrl };
  try {
    const { searchDriveForSheet } = await import("../tools/adapters/googleSheets.ts");
    const hit = await searchDriveForSheet(client.name);
    if (!hit) return { url: null, reason: `No sheet named like "${client.name}" found in Drive (or Google isn't connected). Paste the link once and it sticks.` };
    const url = `https://docs.google.com/spreadsheets/d/${hit.sheetId}`;
    await prisma.client.update({ where: { id: client.id }, data: { sheetUrl: url } }).catch(() => {});
    return { url, found: hit.title };
  } catch (err: any) {
    return { url: null, reason: `Drive search unavailable — ${String(err?.message ?? err).slice(0, 120)}. Paste the sheet link once and it sticks.` };
  }
}

/** A roster row's trend summary: how many of the athlete's measures are moving
 *  the right way. Oriented like improvementPct — "improving" always means
 *  "got better", whichever direction better is for that measure. Null when no
 *  measure has two points yet: no trend is a fact, not a zero. */
export type TrendSummary = {
  improving: number;
  declining: number;
  flat: number;
  avgPct: number; // mean improvementPct across trended measures, 0.1 precision
};

/** The roster in one read: every athlete (both kinds), their headline numbers,
 *  when they last logged, and whether their numbers are moving — what the
 *  Athletes page opens on and what "who's trending well" sorts by. */
export async function athleteRoster() {
  const [clients, metrics] = await Promise.all([
    prisma.client.findMany({
      select: { id: true, name: true, kind: true, status: true, sport: true, position: true, gradYear: true },
      orderBy: { startedAt: "asc" },
    }),
    // One scan serves counts, last-logged AND trends. Same ordering contract
    // as athletePerformance (tie-broken), same (label|unit) bucketing — the
    // roster chip must never disagree with the detail panel it opens into.
    prisma.metric.findMany({
      orderBy: [{ achievedAt: "asc" }, { createdAt: "asc" }],
      select: { clientId: true, label: true, value: true, unit: true, isPR: true, achievedAt: true },
    }),
  ]);

  const byClient = new Map<string, typeof metrics>();
  for (const m of metrics) {
    const bucket = byClient.get(m.clientId);
    if (bucket) bucket.push(m);
    else byClient.set(m.clientId, [m]);
  }

  return clients.map((c) => {
    const mine = byClient.get(c.id) ?? [];
    const buckets = new Map<string, typeof mine>();
    for (const m of mine) {
      const key = `${m.label.trim().toLowerCase()}|${(m.unit ?? "").trim().toLowerCase()}`;
      const b = buckets.get(key);
      if (b) b.push(m);
      else buckets.set(key, [m]);
    }
    const pcts: number[] = [];
    for (const b of buckets.values()) {
      if (b.length < 2) continue;
      const first = b[0]!;
      const latest = b[b.length - 1]!;
      if (first.value === 0) continue;
      const raw = ((latest.value - first.value) / Math.abs(first.value)) * 100;
      pcts.push(Math.round((lowerIsBetter(latest.label) ? -raw : raw) * 10) / 10);
    }
    const trend: TrendSummary | null = pcts.length
      ? {
          improving: pcts.filter((p) => p > 0).length,
          declining: pcts.filter((p) => p < 0).length,
          flat: pcts.filter((p) => p === 0).length,
          avgPct: Math.round((pcts.reduce((s, p) => s + p, 0) / pcts.length) * 10) / 10,
        }
      : null;
    return {
      ...c,
      lastLoggedAt: mine.length ? mine[mine.length - 1]!.achievedAt : null,
      prCount: mine.filter((m) => m.isPR).length,
      metricCount: mine.length,
      trend,
    };
  });
}
