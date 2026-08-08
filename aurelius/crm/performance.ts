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
  lastLoggedAt: Date | null;
  prCount: number;
  series: MetricSeries[];
  recentPRs: Array<{ label: string; value: number; unit: string | null; achievedAt: Date }>;
};

/** Everything the per-athlete panel needs, in one read. Null → no such athlete. */
export async function athletePerformance(clientId: string): Promise<AthletePerformance | null> {
  const [client, metrics] = await Promise.all([
    prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true, name: true, kind: true, status: true, sport: true, position: true, gradYear: true, isMinor: true, notes: true },
    }),
    prisma.metric.findMany({
      where: { clientId },
      // Secondary key (council catch): bulk session logging can land identical
      // achievedAt timestamps, and a tie leaves row order unspecified — latest
      // value/casing/unit would flip between page loads.
      orderBy: [{ achievedAt: "asc" }, { createdAt: "asc" }],
      select: { label: true, value: true, unit: true, isPR: true, achievedAt: true },
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

  const series: MetricSeries[] = [];
  for (const bucket of byLabel.values()) {
    const latest = bucket[bucket.length - 1]!;
    const first = bucket[0]!;
    const lower = lowerIsBetter(latest.label);
    const best = bucket.reduce((b, m) => (lower ? (m.value < b.value ? m : b) : m.value > b.value ? m : b));
    const rawPct = first.value !== 0 && bucket.length > 1 ? ((latest.value - first.value) / Math.abs(first.value)) * 100 : null;
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
    });
  }
  // Most-recently-trained first — the lift you're working on tops the panel.
  series.sort((a, b) => b.latest.achievedAt.getTime() - a.latest.achievedAt.getTime());

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
  };
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
