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
      orderBy: { achievedAt: "asc" },
      select: { label: true, value: true, unit: true, isPR: true, achievedAt: true },
    }),
  ]);
  if (!client) return null;

  // Group case-insensitively — "Squat" and "squat" are the same lift — but
  // display whatever casing was logged most recently.
  const byLabel = new Map<string, typeof metrics>();
  for (const m of metrics) {
    const key = m.label.trim().toLowerCase();
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

/** The roster in one read: every athlete (both kinds), their headline numbers,
 *  and when they last logged — what the Athletes page opens on. */
export async function athleteRoster() {
  const [clients, latest, prCounts, metricCounts] = await Promise.all([
    prisma.client.findMany({
      select: { id: true, name: true, kind: true, status: true, sport: true, position: true, gradYear: true },
      orderBy: { startedAt: "asc" },
    }),
    prisma.metric.groupBy({ by: ["clientId"], _max: { achievedAt: true } }),
    prisma.metric.groupBy({ by: ["clientId"], _count: { _all: true }, where: { isPR: true } }),
    prisma.metric.groupBy({ by: ["clientId"], _count: { _all: true } }),
  ]);
  const lastBy = new Map(latest.map((r) => [r.clientId, r._max.achievedAt]));
  const prBy = new Map(prCounts.map((r) => [r.clientId, r._count._all]));
  const nBy = new Map(metricCounts.map((r) => [r.clientId, r._count._all]));
  return clients.map((c) => ({
    ...c,
    lastLoggedAt: lastBy.get(c.id) ?? null,
    prCount: prBy.get(c.id) ?? 0,
    metricCount: nBy.get(c.id) ?? 0,
  }));
}
