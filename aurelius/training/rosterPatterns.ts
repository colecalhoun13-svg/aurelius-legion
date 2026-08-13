// aurelius/training/rosterPatterns.ts
//
// CROSS-ATHLETE PATTERN SENSE (NORTH_STAR #11) — the roster read as a FIELD,
// not one athlete at a time. The Monday trend sweep watches each athlete's
// series; this asks the question only the whole roster can answer: which
// measures are moving ACROSS athletes (a stimulus that's working) and which
// are collectively stalling (a programming gap worth a look)?
//
// Coaching domain, BOTH athlete kinds — a roster-wide stall is a coaching fact,
// not a business one. Observations ONLY (hard rule 5): it names what the
// numbers are doing across athletes; the coaching call stays Cole's. It never
// prescribes a change, only surfaces the pattern.
//
// Statistically honest: a "pattern" needs at least MIN_ATHLETES athletes with a
// real trend on the same measure — one athlete moving is a data point, not a
// roster pattern, and calling it one would be the kind of false signal that
// erodes trust in every other signal.

import { prisma } from "../core/db/prisma.ts";
import { lowerIsBetter } from "../crm/retention.ts";

const MIN_ATHLETES = 2; // below this it isn't a roster pattern, it's one athlete
const MOVING = 1.5; // avg % beyond which the roster is genuinely moving on a measure

export type MeasurePattern = {
  measure: string;
  unit: string;
  athletes: number; // how many athletes have a real trend on this measure
  improving: number;
  declining: number;
  flat: number;
  avgPct: number; // roster-wide mean improvement %, orientation-corrected
};

export type RosterPatterns = {
  athletes: number; // active athletes considered
  working: MeasurePattern[]; // measures the roster is collectively moving up
  stalling: MeasurePattern[]; // measures collectively flat or sliding
  note: string;
};

export async function crossAthletePatterns(): Promise<RosterPatterns> {
  const clients = await prisma.client.findMany({
    where: { status: "active" },
    select: { id: true },
  });
  if (clients.length === 0) {
    return { athletes: 0, working: [], stalling: [], note: "No active athletes on the roster — no field to read yet." };
  }

  const metrics = await prisma.metric.findMany({
    orderBy: [{ achievedAt: "asc" }, { createdAt: "asc" }],
    select: { clientId: true, label: true, value: true, unit: true },
  });

  // measureKey → per-athlete improvement% (one entry per athlete who has ≥2
  // points on that measure). Bucketed exactly like athletePerformance so the
  // roster view and the detail panel can never disagree.
  const byMeasure = new Map<string, { label: string; unit: string; pcts: Map<string, number> }>();
  // First split metrics per (athlete, measure), preserving order.
  const perAthleteMeasure = new Map<string, typeof metrics>();
  for (const m of metrics) {
    const mk = `${m.clientId}¦${m.label.trim().toLowerCase()}|${(m.unit ?? "").trim().toLowerCase()}`;
    const b = perAthleteMeasure.get(mk);
    if (b) b.push(m);
    else perAthleteMeasure.set(mk, [m]);
  }
  for (const [mk, series] of perAthleteMeasure) {
    if (series.length < 2) continue;
    const first = series[0]!;
    const latest = series[series.length - 1]!;
    if (first.value === 0) continue;
    const raw = ((latest.value - first.value) / Math.abs(first.value)) * 100;
    const pct = Math.round((lowerIsBetter(latest.label) ? -raw : raw) * 10) / 10;
    const clientId = mk.split("¦")[0]!;
    const measureKey = `${latest.label.trim().toLowerCase()}|${(latest.unit ?? "").trim().toLowerCase()}`;
    let bucket = byMeasure.get(measureKey);
    if (!bucket) {
      bucket = { label: latest.label, unit: latest.unit ?? "", pcts: new Map() };
      byMeasure.set(measureKey, bucket);
    }
    bucket.pcts.set(clientId, pct);
  }

  const patterns: MeasurePattern[] = [];
  for (const bucket of byMeasure.values()) {
    const pcts = [...bucket.pcts.values()];
    if (pcts.length < MIN_ATHLETES) continue;
    patterns.push({
      measure: bucket.label,
      unit: bucket.unit,
      athletes: pcts.length,
      improving: pcts.filter((p) => p > 0).length,
      declining: pcts.filter((p) => p < 0).length,
      flat: pcts.filter((p) => p === 0).length,
      avgPct: Math.round((pcts.reduce((s, p) => s + p, 0) / pcts.length) * 10) / 10,
    });
  }

  const working = patterns
    .filter((p) => p.avgPct >= MOVING && p.improving >= p.declining)
    .sort((a, b) => b.avgPct - a.avgPct);
  const stalling = patterns
    .filter((p) => p.avgPct <= 0 || p.declining > p.improving)
    .sort((a, b) => a.avgPct - b.avgPct);

  const note =
    patterns.length === 0
      ? `Not enough repeated measures across athletes yet — a roster pattern needs the same lift/test logged for ${MIN_ATHLETES}+ athletes over time.`
      : "Observations across the roster — the coaching call is yours.";

  return { athletes: clients.length, working, stalling, note };
}

/**
 * The weekly proactive surface: one training-domain signal naming what's moving
 * and what's stalling across the roster, deduped per week. Shows up on its own
 * — Cole doesn't have to open the Athletes page or ask. Empty-honest: says
 * nothing (and files nothing) until there's a real pattern to name.
 */
export async function runRosterPatternSweep(now = new Date()): Promise<{ ran: boolean; reason: string; patterns: number }> {
  const rp = await crossAthletePatterns();
  const total = rp.working.length + rp.stalling.length;
  if (total === 0) {
    return { ran: false, reason: rp.note, patterns: 0 };
  }

  const fmt = (p: MeasurePattern) =>
    `• ${p.measure}: ${p.improving}/${p.athletes} improving${p.avgPct !== 0 ? `, ${p.avgPct > 0 ? "+" : ""}${p.avgPct}% avg` : ""}`;
  const lines: string[] = [];
  if (rp.working.length) lines.push("Working across the roster:", ...rp.working.slice(0, 4).map(fmt));
  if (rp.stalling.length) {
    if (lines.length) lines.push("");
    lines.push("Stalling across the roster:", ...rp.stalling.slice(0, 4).map(fmt));
  }

  const week = `${now.getUTCFullYear()}-w${Math.ceil(((now.getTime() - Date.UTC(now.getUTCFullYear(), 0, 1)) / 86400_000 + 1) / 7)}`;
  const { surfaceSignal } = await import("../core/bridge.ts");
  await surfaceSignal({
    kind: "opportunity",
    domain: "training",
    sourceType: "roster_patterns",
    sourceId: `roster:${week}`,
    severity: "notice",
    title: `Roster patterns — ${rp.working.length} working · ${rp.stalling.length} stalling`,
    body: lines.join("\n") + `\n\n${rp.note} Full trends on the Athletes page.`,
  }).catch(() => {});

  return { ran: true, reason: "surfaced", patterns: total };
}
