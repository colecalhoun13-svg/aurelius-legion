import { NextResponse } from "next/server";

// THE WINDSHIELD FEED (alignment council): Home showed position everywhere
// and trajectory nowhere. One cheap call answers "what's coming": the next
// calendar event with its start, roughly how many free hours remain today,
// and Aurelius's own next scheduled move. DB + env — never static.
export const dynamic = "force-dynamic";

// Mirror of the cron roster in aurelius/index.ts (same precedent as the
// WEEKLY list in /api/spine — the schedule itself lives in the backend
// process and can't be imported here). Keep in step when the spine changes.
const DAILY: Array<{ t: string; label: string }> = [
  { t: "02:00", label: "database backup" },
  { t: "06:00", label: "RSS ingest" },
  { t: "06:30", label: "market pulse" },
  { t: "06:45", label: "schedule protection" },
  { t: "07:00", label: "morning briefing" },
  { t: "08:00", label: "initiative pulse" },
  { t: "13:00", label: "midday check" },
  { t: "21:15", label: "queue sweep" },
  { t: "21:30", label: "nightly debrief" },
];
const SUNDAY: Array<{ t: string; label: string }> = [
  { t: "09:00", label: "weekend research" },
  { t: "17:00", label: "persona observer" },
  { t: "18:00", label: "weekly planning" },
  { t: "19:00", label: "freshness sweep" },
  { t: "19:30", label: "capability gaps" },
  { t: "20:00", label: "weekly scoreboard" },
  { t: "21:00", label: "decision curriculum" },
  { t: "22:00", label: "curriculum ingest" },
];

export async function GET() {
  try {
    const { prisma } = await import("../../../../aurelius/core/db/prisma");
    const tz = process.env.AURELIUS_TZ?.trim() || undefined;
    const now = new Date();

    // Local clock pieces in the operator's timezone.
    const hm = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: tz });
    const weekday = now.toLocaleDateString("en-US", { weekday: "short", timeZone: tz });
    const todayKey = now.toLocaleDateString("en-CA", { timeZone: tz });

    // Aurelius's next move — today's remaining roster, else tomorrow's first.
    const roster = [...DAILY, ...(weekday === "Sun" ? SUNDAY : [])].sort((a, b) => a.t.localeCompare(b.t));
    const upcoming = roster.find((j) => j.t > hm);
    const tomorrowWeekday = new Date(now.getTime() + 86400_000).toLocaleDateString("en-US", { weekday: "short", timeZone: tz });
    const tomorrowRoster = [...DAILY, ...(tomorrowWeekday === "Sun" ? SUNDAY : [])].sort((a, b) => a.t.localeCompare(b.t));
    const nextMove = upcoming
      ? { time: upcoming.t, label: upcoming.label, tomorrow: false }
      : { time: tomorrowRoster[0]!.t, label: tomorrowRoster[0]!.label, tomorrow: true };

    // Next calendar event within 48h.
    const nextEventRow = await prisma.calendarEvent.findFirst({
      where: { startAt: { gte: now, lte: new Date(now.getTime() + 48 * 3600_000) } },
      orderBy: { startAt: "asc" },
      select: { title: true, startAt: true, raw: true },
    });
    const nextEvent = nextEventRow
      ? {
          title: nextEventRow.title,
          startAt: nextEventRow.startAt,
          allDay: !!(nextEventRow.raw as any)?.allDay,
        }
      : null;

    // Free hours left today (glance-grade): the window from now to 22:00
    // local, minus the timed events still ahead today.
    const nowHour = Number(hm.slice(0, 2)) + Number(hm.slice(3, 5)) / 60;
    let freeHours = Math.max(0, 22 - nowHour);
    if (freeHours > 0) {
      const eventsAhead = await prisma.calendarEvent.findMany({
        where: { startAt: { gte: now, lte: new Date(now.getTime() + 24 * 3600_000) } },
        select: { startAt: true, endAt: true, raw: true },
      });
      const busy = eventsAhead
        .filter((e) => !(e.raw as any)?.allDay)
        .filter((e) => e.startAt.toLocaleDateString("en-CA", { timeZone: tz }) === todayKey)
        .reduce((h, e) => h + Math.max(0, (e.endAt.getTime() - e.startAt.getTime()) / 3600_000), 0);
      freeHours = Math.max(0, freeHours - busy);
    }

    return NextResponse.json({
      nextEvent,
      freeHours: Math.round(freeHours * 2) / 2,
      nextMove,
    });
  } catch (error: any) {
    console.error("Upnext error:", error);
    return NextResponse.json({ error: error?.message ?? "Failed to load up-next" }, { status: 500 });
  }
}
