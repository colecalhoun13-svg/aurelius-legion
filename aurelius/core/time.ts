// aurelius/core/time.ts
//
// Operator-local time. "Today" must mean Cole's calendar day, not the server's
// UTC day — otherwise "what's on today" in the evening shows tomorrow's deck, and
// the morning briefing is built for the wrong date. The server doesn't guess a
// timezone; set AURELIUS_TZ to an IANA zone (e.g. "America/New_York"). Unset →
// falls back to the host's local zone (correct on the Mac Mini; UTC in a codespace).

export function operatorTimeZone(): string | undefined {
  return process.env.AURELIUS_TZ?.trim() || undefined;
}

/** Cole's local calendar day as YYYY-MM-DD (the string every day-scoped query
 *  keys off). en-CA formats as YYYY-MM-DD; timeZone undefined = host local. */
export function operatorToday(): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: operatorTimeZone(),
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  } catch {
    // Bad AURELIUS_TZ → don't crash the day; fall back to UTC date.
    return new Date().toISOString().slice(0, 10);
  }
}

/** The wall-clock offset (ms) between `tz` and UTC for a specific instant —
 *  DST-correct because it's computed AT that instant, not from a fixed table. */
function tzOffsetMs(instant: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const m: Record<string, number> = {};
  for (const p of parts) if (p.type !== "literal") m[p.type] = Number(p.value);
  const asUTC = Date.UTC(m.year!, m.month! - 1, m.day!, m.hour!, m.minute!, m.second!);
  return asUTC - instant.getTime();
}

/**
 * The half-open UTC instant range [start, end) for Cole's LOCAL calendar day.
 *
 * THE FIX (2026-08-11 council): callers used to build `new Date(\`${dstr}T00:00:00.000Z\`)`
 * — UTC midnight of the local date string — so under America/* the day window was
 * shifted by the offset and Cole's EVENING sessions (17:00+) fell outside "today":
 * invisible to the morning briefing, the Today view, and session prep. This anchors
 * the window to local midnight in AURELIUS_TZ, converted to the true UTC instants.
 * One definition; every day-scoped query keys off it.
 */
export function operatorDayRange(dateStr?: string): { dstr: string; date: Date; start: Date; end: Date } {
  const dstr = dateStr ?? operatorToday();
  const tz = operatorTimeZone();
  // Local midnight of dstr, expressed as a UTC instant.
  const naiveMidnightUtc = new Date(`${dstr}T00:00:00.000Z`).getTime();
  let start: Date;
  if (!tz) {
    // No configured zone → host-local midnight (correct on the Mini).
    start = new Date(`${dstr}T00:00:00.000`);
  } else {
    // Correct the naive-UTC midnight by the zone's offset at that instant.
    const offset = tzOffsetMs(new Date(naiveMidnightUtc), tz);
    start = new Date(naiveMidnightUtc - offset);
  }
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { dstr, date: start, start, end };
}
