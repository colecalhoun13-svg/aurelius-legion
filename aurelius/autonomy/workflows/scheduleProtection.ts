// aurelius/autonomy/workflows/scheduleProtection.ts
//
// THE FIRST ACTING WORKFLOW (NORTH_STAR §6 Block 4, first live grant).
// Aurelius defends deep-work time: it scans the next few days, finds days with
// no protected focus block, picks the best free window, and — through the
// executor — either PLACES the hold (if `calendar.schedule_protection` is
// granted) or PROPOSES it on the Bridge (if not). Reversible either way: a hold
// is a calendar event Cole can delete, and it lands on the Bridge as an
// executed proposal.
//
// This is the safest possible first action (calendar edits, not email or
// money), fully reversible, and it fires daily — so it earns trust fast. It's
// the template every later workflow copies: detect → prepare → executeAction.

import { prisma } from "../../core/db/prisma.ts";
import { findAvailability, createCalendarEvent, listEventsRange } from "../../calendar/engine.ts";
import { executeAction } from "../executor.ts";

const ACTION_CLASS = "calendar.schedule_protection";
const FOCUS_RE = /deep\s*work|deep-work|focus block|focus time/i;

/**
 * The commit step — registered in the action registry so it runs both when
 * granted (act now) and when Cole confirms a proposal later. Payload is plain
 * JSON so it survives a restart.
 */
export async function finalizeScheduleProtection(payload: {
  startAt: string;
  endAt: string;
}): Promise<any> {
  return createCalendarEvent({
    title: "Deep Work (protected)",
    startAt: new Date(payload.startAt),
    endAt: new Date(payload.endAt),
    domain: "personal",
    description:
      "Held by Aurelius under the schedule-protection grant. Delete it if you need the time.",
  });
}

export type ScheduleProtectionResult = {
  scanned: number; // days looked at
  opportunities: number; // days that needed a hold
  finalized: number; // holds actually placed (granted)
  gated: number; // holds proposed for Cole's confirm (ungranted)
  failed: number;
  signals: string[]; // bridgeSignal ids produced
};

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * Ensure each of the next `days` waking days has one protected focus block of
 * `blockMinutes`. Days that already hold a focus block are left alone.
 */
export async function runScheduleProtection(opts: {
  days?: number;
  blockMinutes?: number;
} = {}): Promise<ScheduleProtectionResult> {
  const days = Math.min(opts.days ?? 3, 14);
  const blockMinutes = opts.blockMinutes ?? 90;

  const result: ScheduleProtectionResult = {
    scanned: days,
    opportunities: 0,
    finalized: 0,
    gated: 0,
    failed: 0,
    signals: [],
  };

  const availability = await findAvailability({ days, minMinutes: blockMinutes });

  for (const day of availability) {
    // Day already has a focus block? Leave it — don't stack holds.
    const dayStart = new Date(day.date + "T00:00:00");
    const dayEnd = new Date(dayStart.getTime() + 86400_000);
    const existing = await listEventsRange(dayStart, dayEnd);
    if (existing.some((e) => FOCUS_RE.test(e.title))) continue;

    // Best free window = the largest slot that fits the block.
    const slot = [...day.slots].sort((a, b) => b.minutes - a.minutes)[0];
    if (!slot || slot.minutes < blockMinutes) continue;

    // Dedup on a stable per-day key: if this day ALREADY produced a protection
    // signal — pending, acted, OR dismissed — don't re-file it. Counting only
    // "pending" was the bug: once Cole DISMISSED a hold, its status left pending
    // and the next morning's sweep re-proposed the exact same day forever — the
    // confirm-firehose we refuse to build. One day = one decision.
    const dedupKey = `schprot:${day.date}`;
    const alreadyProposed = await prisma.bridgeSignal.count({
      where: { sourceType: "schedule_protection", sourceId: dedupKey },
    });
    if (alreadyProposed > 0) continue;

    result.opportunities++;
    const startAt = new Date(slot.start);
    const endAt = new Date(startAt.getTime() + blockMinutes * 60000);
    // Render in LOCAL time throughout — the old label mixed startAt.getDay()
    // (local) with toISOString() time (UTC), so it showed the wrong weekday/time
    // under a non-UTC TZ. One zone, consistently.
    const pad = (n: number) => String(n).padStart(2, "0");
    const localHM = `${pad(startAt.getHours())}:${pad(startAt.getMinutes())}`;
    const when = `${WEEKDAY[startAt.getDay()]} ${pad(startAt.getMonth() + 1)}-${pad(startAt.getDate())} ${localHM}`;

    try {
      const exec = await executeAction({
        actionClass: ACTION_CLASS,
        sourceType: "schedule_protection",
        sourceId: dedupKey,
        prepare: async () => ({
          title: `Protect ${blockMinutes} min of deep work — ${when}`,
          body: `Your best free window that day is ${slot.minutes} min starting ${localHM}. I'd hold ${blockMinutes} min of it as a focus block.`,
          domain: "personal",
          payload: { startAt: startAt.toISOString(), endAt: endAt.toISOString(), blockMinutes },
        }),
      });
      result.signals.push(exec.bridgeSignalId);
      if (exec.finalized) result.finalized++;
      else result.gated++;
    } catch (err: any) {
      // A finalize failure (e.g. calendar not connected) is honest, not fatal —
      // one bad day doesn't sink the sweep.
      result.failed++;
      console.warn(`[scheduleProtection] ${when} failed:`, err?.message ?? err);
    }
  }

  console.log(
    `[scheduleProtection] scanned ${result.scanned}d · ${result.opportunities} opportunities · ${result.finalized} placed · ${result.gated} proposed · ${result.failed} failed`
  );
  return result;
}

/** True when there are unprotected days worth surfacing — used by rituals. */
export async function hasUnprotectedDays(days = 3, blockMinutes = 90): Promise<boolean> {
  const availability = await findAvailability({ days, minMinutes: blockMinutes });
  for (const day of availability) {
    const dayStart = new Date(day.date + "T00:00:00");
    const existing = await listEventsRange(dayStart, new Date(dayStart.getTime() + 86400_000));
    if (existing.some((e) => FOCUS_RE.test(e.title))) continue;
    if (day.slots.some((s) => s.minutes >= blockMinutes)) return true;
  }
  return false;
}
