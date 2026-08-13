// aurelius/health/whoop.ts
//
// WHOOP READINESS (NORTH_STAR #8, #46) — Cole's own recovery/strain/sleep, his
// data first (Athlete Zero). Direct WHOOP API, dormant until WHOOP_ACCESS_TOKEN
// lands, live the moment it does.
//
// The readings land as Metric rows on the SELF record (source "whoop"), written
// with raw prisma — NOT through logMetric — deliberately: a daily recovery score
// isn't a "personal best," so it must not trip PR detection or the onPeak
// business machinery. Once stored, the whole coaching eye (performance, dev
// curves) reads them like any measure, and latestReadiness() serves the tab
// even between syncs.
//
// Readiness is a SIGNAL domain (hard rule 5): a low-recovery day surfaces a
// training-domain notice; the training call stays Cole's. Nothing here is a
// medical claim — it reports WHOOP's own numbers, no diagnosis.

import { prisma } from "../core/db/prisma.ts";

const WHOOP_API = "https://api.prod.whoop.com/developer";

export function whoopConfigured(): boolean {
  return !!process.env.WHOOP_ACCESS_TOKEN?.trim();
}

export function whoopStatus(): { configured: boolean; reason: string | null } {
  return whoopConfigured()
    ? { configured: true, reason: null }
    : { configured: false, reason: "WHOOP is dormant — set WHOOP_ACCESS_TOKEN (a WHOOP developer OAuth token) and I'll pull your recovery, strain, and sleep." };
}

export type Readiness = {
  recovery: number | null; // 0-100
  hrv: number | null; // ms (rmssd)
  restingHr: number | null; // bpm
  at: Date | null;
};

/** Latest stored readiness on the self record — works from stored data even
 *  between syncs; null when nothing has been pulled yet. */
export async function latestReadiness(): Promise<Readiness> {
  const { getSelf } = await import("../athlete/self.ts");
  const self = await getSelf();
  if (!self) return { recovery: null, hrv: null, restingHr: null, at: null };
  const rows = await prisma.metric.findMany({
    where: { clientId: self.id, source: "whoop", label: { in: ["recovery", "hrv", "resting_hr"] } },
    orderBy: { achievedAt: "desc" },
    take: 30,
    select: { label: true, value: true, achievedAt: true },
  });
  const pick = (l: string) => rows.find((r) => r.label === l) ?? null;
  const rec = pick("recovery");
  return {
    recovery: rec?.value ?? null,
    hrv: pick("hrv")?.value ?? null,
    restingHr: pick("resting_hr")?.value ?? null,
    at: rec?.achievedAt ?? null,
  };
}

/** Pull the latest recovery from WHOOP and store it on the self record.
 *  Dormant-honest: no token → a clean skip, never an error or a fake reading. */
export async function syncWhoop(): Promise<{ ran: boolean; reason: string; stored: number }> {
  if (!whoopConfigured()) return { ran: false, reason: "dormant — no WHOOP_ACCESS_TOKEN", stored: 0 };

  let recovery: { score?: number; hrv?: number; rhr?: number; at?: string } | null = null;
  try {
    const res = await fetch(`${WHOOP_API}/v1/recovery?limit=1`, {
      headers: { Authorization: `Bearer ${process.env.WHOOP_ACCESS_TOKEN!.trim()}` },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return { ran: false, reason: `WHOOP API ${res.status}: ${(await res.text()).slice(0, 120)}`, stored: 0 };
    const j: any = await res.json();
    const rec = j?.records?.[0];
    const s = rec?.score;
    if (s) recovery = { score: s.recovery_score, hrv: s.hrv_rmssd_milli, rhr: s.resting_heart_rate, at: rec?.created_at };
  } catch (err: any) {
    return { ran: false, reason: `WHOOP fetch failed: ${(err?.message ?? String(err)).slice(0, 120)}`, stored: 0 };
  }
  if (!recovery || recovery.score == null) return { ran: true, reason: "no new recovery record", stored: 0 };

  const { getOrCreateSelf } = await import("../athlete/self.ts");
  const self = await getOrCreateSelf();
  const at = recovery.at ? new Date(recovery.at) : new Date();
  const readings: Array<{ label: string; value: number; unit: string }> = [
    { label: "recovery", value: Math.round(recovery.score), unit: "%" },
    ...(recovery.hrv != null ? [{ label: "hrv", value: Math.round(recovery.hrv), unit: "ms" }] : []),
    ...(recovery.rhr != null ? [{ label: "resting_hr", value: Math.round(recovery.rhr), unit: "bpm" }] : []),
  ];
  // Dedup on (self, label, day) so a re-sync doesn't stack duplicate readings.
  const dayStart = new Date(at);
  dayStart.setHours(0, 0, 0, 0);
  let stored = 0;
  for (const r of readings) {
    const exists = await prisma.metric.count({
      where: { clientId: self.id, source: "whoop", label: r.label, achievedAt: { gte: dayStart } },
    });
    if (exists > 0) continue;
    await prisma.metric.create({
      data: { clientId: self.id, label: r.label, value: r.value, unit: r.unit, source: "whoop", achievedAt: at, isPR: false },
    });
    stored++;
  }

  // Readiness signal (observation only): a low recovery day is worth flagging —
  // Cole decides what to do with it. Deduped per day.
  if (recovery.score < 34) {
    const { surfaceSignal } = await import("../core/bridge.ts");
    await surfaceSignal({
      kind: "opportunity",
      domain: "training",
      sourceType: "readiness",
      sourceId: `readiness:${dayStart.toISOString().slice(0, 10)}`,
      severity: "notice",
      title: `Recovery is low today — ${Math.round(recovery.score)}%`,
      body: `WHOOP has you in the red (${Math.round(recovery.score)}% recovery${recovery.hrv != null ? `, HRV ${Math.round(recovery.hrv)}ms` : ""}). An observation, not a prescription — you know how you feel. Consider it before a heavy session.`,
    }).catch(() => {});
  }

  return { ran: true, reason: "synced", stored };
}
