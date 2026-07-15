// aurelius/core/salience.ts
//
// THE SALIENCE ENGINE (master-class #2 — anticipation over cron). The acting
// layer already decides WHAT to do; salience decides WHETHER and WHEN it's worth
// interrupting Cole. Without it, everything either sits silently on the Bridge or
// waits for the next fixed-time ritual. With it, a genuinely urgent, high-leverage
// thing reaches his phone in the moment, and noise stays quiet.
//
// Score = severity × kind-weight, nudged by urgency (a near due-time) and damped
// in quiet hours. Deliberately simple and legible — a scorer you can reason about,
// not a black box.

import { operatorTimeZone } from "./time.ts";

export type SalienceInput = {
  kind?: string;      // "risk" | "opportunity" | "gap_alert" | "cole_steer" | "proposal_batch" | "background_result"
  severity?: string;  // "critical" | "attention" | "notice" | "info"
  domain?: string | null;
  dueAt?: Date | string | null; // when the thing it's about happens (optional)
};

const SEVERITY_WEIGHT: Record<string, number> = {
  critical: 1.0,
  attention: 0.7,
  notice: 0.4,
  info: 0.2,
};

const KIND_WEIGHT: Record<string, number> = {
  risk: 1.0,
  gap_alert: 0.95,
  cole_steer: 0.9,
  opportunity: 0.8,
  proposal_batch: 0.6,
  background_result: 0.4,
};

/** 0..1 — how much this deserves Cole's attention right now. */
export function scoreSalience(sig: SalienceInput): number {
  const sev = SEVERITY_WEIGHT[(sig.severity ?? "info").toLowerCase()] ?? 0.2;
  const kind = KIND_WEIGHT[(sig.kind ?? "background_result").toLowerCase()] ?? 0.4;
  let score = sev * 0.65 + kind * 0.35;

  // Urgency nudge: the sooner the thing happens, the more it matters now.
  if (sig.dueAt) {
    const due = sig.dueAt instanceof Date ? sig.dueAt : new Date(sig.dueAt);
    if (!Number.isNaN(due.getTime())) {
      const hours = (due.getTime() - Date.now()) / 3_600_000;
      if (hours >= 0 && hours <= 2) score += 0.2;
      else if (hours > 2 && hours <= 12) score += 0.1;
    }
  }
  return Math.max(0, Math.min(1, score));
}

/** Local hour in Cole's zone (for quiet-hours). */
function operatorHour(): number {
  try {
    const s = new Intl.DateTimeFormat("en-US", { timeZone: operatorTimeZone(), hour: "2-digit", hour12: false }).format(new Date());
    return Number(s) % 24;
  } catch {
    return new Date().getHours();
  }
}

/**
 * Should this push to Cole's phone NOW, or wait on the Bridge for the next ritual?
 * High salience pushes; quiet hours (22:00–07:00) suppress everything short of
 * CRITICAL so Aurelius doesn't buzz him at 3am over an opportunity.
 */
export function shouldPushNow(sig: SalienceInput): boolean {
  const score = scoreSalience(sig);
  const critical = (sig.severity ?? "").toLowerCase() === "critical";
  const hour = operatorHour();
  const quiet = hour >= 22 || hour < 7;
  if (quiet && !critical) return false;
  return score >= 0.72 || critical;
}
