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
