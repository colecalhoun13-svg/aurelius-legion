// aurelius/calendar/engine.ts
//
// CALENDAR ENGINE (OG doc Part VIII) — Google Calendar becomes a local
// resource. Sync pulls the primary calendar into CalendarEvent rows
// (externalId-keyed, prunes Google-side deletions), so everything
// downstream — Today view, morning briefing, availability scanning,
// overload detection, weekly planning — reads the DB and never blocks
// on Google. Writes (create_event) go to Google first, then mirror
// locally, so the calendar stays the source of truth.
//
// Dormant until Cole completes the one-time OAuth (/api/calendar/auth);
// every entry point fails honestly with the connect instruction.

import { prisma } from "../core/db/prisma.ts";
import { runTraced } from "../core/trace.ts";
import {
  calendarFetch,
  isCalendarConnected,
  isCalendarConfigured,
} from "./googleAuth.ts";

const SYNC_DAYS_BACK = 7;
const SYNC_DAYS_AHEAD = 60;
const MAX_PAGES = 4; // 250 events/page — 1000 events in a 60-day window is plenty

// ── Sync: Google → CalendarEvent rows ────────────────────────────────

type GoogleEvent = {
  id: string;
  status?: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  attendees?: Array<{ email?: string; displayName?: string; responseStatus?: string }>;
};

function eventTimes(e: GoogleEvent): { startAt: Date; endAt: Date; allDay: boolean } | null {
  if (e.start?.dateTime && e.end?.dateTime) {
    return { startAt: new Date(e.start.dateTime), endAt: new Date(e.end.dateTime), allDay: false };
  }
  if (e.start?.date && e.end?.date) {
    return {
      startAt: new Date(`${e.start.date}T00:00:00.000Z`),
      endAt: new Date(`${e.end.date}T00:00:00.000Z`),
      allDay: true,
    };
  }
  return null;
}

export async function syncCalendar(opts: { daysBack?: number; daysAhead?: number } = {}) {
  if (!(await isCalendarConnected())) {
    return { ok: false as const, reason: "not_connected" as const };
  }
  const timeMin = new Date(Date.now() - (opts.daysBack ?? SYNC_DAYS_BACK) * 86400_000);
  const timeMax = new Date(Date.now() + (opts.daysAhead ?? SYNC_DAYS_AHEAD) * 86400_000);

  const seen: string[] = [];
  let upserted = 0;
  let removed = 0;
  let pageToken: string | undefined;

  for (let page = 0; page < MAX_PAGES; page++) {
    const params = new URLSearchParams({
      singleEvents: "true", // recurring events arrive expanded
      orderBy: "startTime",
      maxResults: "250",
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
    });
    if (pageToken) params.set("pageToken", pageToken);
    const res = await calendarFetch(`/calendars/primary/events?${params}`);
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`calendar list failed: ${res.status} ${body.slice(0, 200)}`);
    }
    const json: any = await res.json();
    for (const e of (json.items ?? []) as GoogleEvent[]) {
      if (e.status === "cancelled") {
        removed += (await prisma.calendarEvent.deleteMany({ where: { externalId: e.id } })).count;
        continue;
      }
      const times = eventTimes(e);
      if (!times) continue;
      seen.push(e.id);
      const data = {
        title: e.summary ?? "(untitled)",
        description: e.description ?? null,
        startAt: times.startAt,
        endAt: times.endAt,
        location: e.location ?? null,
        attendees: (e.attendees ?? null) as any,
        syncedAt: new Date(),
        raw: { allDay: times.allDay, status: e.status ?? "confirmed" } as any,
      };
      await prisma.calendarEvent.upsert({
        where: { externalId: e.id },
        create: { externalId: e.id, domain: "personal", ...data },
        update: data,
      });
      upserted++;
    }
    pageToken = json.nextPageToken;
    if (!pageToken) break;
  }

  // Mirror Google-side deletions: anything local in the window that the sweep
  // didn't see no longer exists upstream. BUT only when we actually fetched the
  // whole window — if we hit MAX_PAGES with a live pageToken, pages we never
  // fetched aren't in `seen`, and pruning would delete real upstream events
  // (they'd vanish from Today/briefings/availability). Skip the prune then.
  if (pageToken) {
    console.warn(`[calendar] sync hit MAX_PAGES with more events remaining — skipping prune to avoid deleting unfetched events`);
  } else {
    removed += (
      await prisma.calendarEvent.deleteMany({
        where: { startAt: { gte: timeMin, lte: timeMax }, externalId: { notIn: seen } },
      })
    ).count;
  }

  console.log(`[calendar] sync: ${upserted} events upserted, ${removed} removed`);

  // Event-driven anticipation (master-class #2): the 15-min sync is where new
  // conflicts first appear. If something got booked over a protected focus block,
  // surface it NOW (salience decides whether it also pings the phone) instead of
  // waiting for tomorrow's briefing. Non-fatal.
  try {
    await detectAndSurfaceConflicts(timeMax);
  } catch (err) {
    console.warn("[calendar] conflict scan failed (non-fatal):", (err as any)?.message ?? err);
  }

  return { ok: true as const, upserted, removed, window: { from: timeMin, to: timeMax } };
}

// ── Writes: Google first, local mirror second ────────────────────────

export async function createCalendarEvent(input: {
  title: string;
  startAt: Date;
  endAt: Date;
  description?: string;
  location?: string;
  domain?: string;
}) {
  const res = await calendarFetch(`/calendars/primary/events`, {
    method: "POST",
    body: JSON.stringify({
      summary: input.title,
      description: input.description,
      location: input.location,
      start: { dateTime: input.startAt.toISOString() },
      end: { dateTime: input.endAt.toISOString() },
    }),
  });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok || !json.id) {
    throw new Error(`event create failed: ${json?.error?.message ?? res.status}`);
  }
  const event = await prisma.calendarEvent.upsert({
    where: { externalId: json.id },
    create: {
      externalId: json.id,
      domain: input.domain ?? "personal",
      title: input.title,
      description: input.description ?? null,
      startAt: input.startAt,
      endAt: input.endAt,
      location: input.location ?? null,
      raw: { allDay: false, status: "confirmed" } as any,
    },
    update: { title: input.title, startAt: input.startAt, endAt: input.endAt },
  });
  return event;
}

/**
 * Delete an event upstream + locally. The INVERSE of createCalendarEvent — this
 * is what makes a placed schedule-protection hold genuinely one-tap reversible
 * (master-class #4). Idempotent: a 404/410 upstream (already gone) still clears
 * the local mirror.
 */
export async function deleteCalendarEvent(externalId: string): Promise<{ ok: boolean }> {
  if (!externalId) throw new Error("deleteCalendarEvent needs an externalId");
  // A 404/410 means the event is already gone upstream → idempotent success, and
  // we clear the local mirror. ANY OTHER failure (network, 5xx, or auth lapsed —
  // calendarFetch throws "not connected" when the token is null, which is a REAL
  // risk given the ~7-day OAuth refresh expiry) must propagate: if we swallowed it,
  // returned ok, cleared the mirror, and reported "undone" to Cole, the event would
  // still exist on Google and the next 15-min sync would silently re-upsert it —
  // an undo that lies (hard rule 3). So we do NOT clear the mirror on a genuine
  // failure, and we throw so undoAction keeps the signal "acted" and tells Cole
  // the undo didn't go through.
  const res = await calendarFetch(`/calendars/primary/events/${encodeURIComponent(externalId)}`, { method: "DELETE" });
  if (!res.ok && res.status !== 404 && res.status !== 410) {
    const body = await res.text().catch(() => "");
    throw new Error(`event delete failed: ${res.status} ${body.slice(0, 150)}`);
  }
  await prisma.calendarEvent.deleteMany({ where: { externalId } });
  return { ok: true };
}

// ── Reads: always the local mirror ───────────────────────────────────

export async function listEventsRange(from: Date, to: Date) {
  return prisma.calendarEvent.findMany({
    where: { startAt: { gte: from, lte: to } },
    orderBy: { startAt: "asc" },
  });
}

// ── Availability: free gaps in the waking window ─────────────────────
//
// Day boundaries use server-local time (set TZ on the Mini); event times
// are absolute, so overlaps are exact regardless of zone.

export type FreeSlot = { start: string; end: string; minutes: number };
export type DayAvailability = {
  date: string;
  slots: FreeSlot[];
  busyMinutes: number;
  freeMinutes: number;
};

export async function findAvailability(opts: {
  days?: number;
  minMinutes?: number;
  dayStartHour?: number;
  dayEndHour?: number;
} = {}): Promise<DayAvailability[]> {
  const days = Math.min(opts.days ?? 7, 30);
  const minMinutes = opts.minMinutes ?? 60;
  const startHour = opts.dayStartHour ?? 8;
  const endHour = opts.dayEndHour ?? 21;

  const now = new Date();
  const horizon = new Date(now.getTime() + days * 86400_000);
  const events = await listEventsRange(new Date(now.getTime() - 86400_000), horizon);

  const out: DayAvailability[] = [];
  for (let i = 0; i < days; i++) {
    const day = new Date(now.getTime() + i * 86400_000);
    const windowStart = new Date(day);
    windowStart.setHours(startHour, 0, 0, 0);
    const windowEnd = new Date(day);
    windowEnd.setHours(endHour, 0, 0, 0);
    let cursor = i === 0 && now > windowStart ? new Date(now) : windowStart;

    // Timed events overlapping this window (all-day events don't block hours)
    const busy = events
      .filter((e) => !(e.raw as any)?.allDay && e.startAt < windowEnd && e.endAt > windowStart)
      .sort((a, b) => a.startAt.getTime() - b.startAt.getTime());

    const slots: FreeSlot[] = [];
    let busyMinutes = 0;
    for (const e of busy) {
      const s = e.startAt < windowStart ? windowStart : e.startAt;
      const en = e.endAt > windowEnd ? windowEnd : e.endAt;
      busyMinutes += Math.max(0, (en.getTime() - s.getTime()) / 60000);
      if (s.getTime() - cursor.getTime() >= minMinutes * 60000) {
        slots.push({
          start: cursor.toISOString(),
          end: s.toISOString(),
          minutes: Math.round((s.getTime() - cursor.getTime()) / 60000),
        });
      }
      if (en > cursor) cursor = new Date(en);
    }
    if (windowEnd.getTime() - cursor.getTime() >= minMinutes * 60000) {
      slots.push({
        start: cursor.toISOString(),
        end: windowEnd.toISOString(),
        minutes: Math.round((windowEnd.getTime() - cursor.getTime()) / 60000),
      });
    }

    const windowMinutes = Math.max(0, (windowEnd.getTime() - (i === 0 && now > windowStart ? Math.min(now.getTime(), windowEnd.getTime()) : windowStart.getTime())) / 60000);
    // LOCAL date, not UTC: the slots above are built with setHours() (local),
    // so the day label must be the local calendar day too. toISOString() is UTC
    // and, under a non-UTC TZ (the prod Mac Mini), names a different day near
    // midnight — the downstream focus-block existence check then queries the
    // wrong 24h window and a hold can land on the wrong day.
    const localDate = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
    out.push({
      date: localDate,
      slots,
      busyMinutes: Math.round(busyMinutes),
      freeMinutes: Math.max(0, Math.round(windowMinutes - busyMinutes)),
    });
  }
  return out;
}

// A protected focus/deep-work block — the thing worth defending from double-booking.
const FOCUS_RE = /deep\s*work|deep-work|focus block|focus time/i;

/**
 * Scan the upcoming window for a NON-focus event overlapping a protected focus
 * block and surface it (once per conflict pair). This is the "anticipates vs
 * cron" moment: Cole hears about the double-booking when it lands, not the next
 * morning. Deduped by the two events' ids so a persistent conflict pings once.
 */
export async function detectAndSurfaceConflicts(timeMax: Date): Promise<number> {
  const now = new Date();
  const events = await prisma.calendarEvent.findMany({
    where: { endAt: { gt: now }, startAt: { lte: timeMax } },
    orderBy: { startAt: "asc" },
  });
  const isAllDay = (e: any) => !!(e.raw as any)?.allDay;
  const focus = events.filter((e) => FOCUS_RE.test(e.title) && !isAllDay(e));
  if (focus.length === 0) return 0;

  const { surfaceSignal } = await import("../core/bridge.ts");
  const pad = (n: number) => String(n).padStart(2, "0");
  const fmt = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

  let surfaced = 0;
  for (const f of focus) {
    const overlaps = events.filter(
      (e) => e.id !== f.id && !FOCUS_RE.test(e.title) && !isAllDay(e) && e.startAt < f.endAt && e.endAt > f.startAt
    );
    for (const c of overlaps) {
      const sourceId = `conflict:${f.externalId}:${c.externalId}`;
      const exists = await prisma.bridgeSignal.count({ where: { sourceType: "calendar_conflict", sourceId } });
      if (exists > 0) continue;
      await surfaceSignal({
        kind: "risk",
        domain: "personal",
        sourceType: "calendar_conflict",
        sourceId,
        severity: "attention",
        title: "Conflict on your protected focus time",
        body: `"${c.title}" (${fmt(c.startAt)}–${fmt(c.endAt)}) overlaps your held "${f.title}". Move one, or tell me to reschedule it.`,
        dueAt: f.startAt,
      });
      surfaced++;
    }
  }
  if (surfaced > 0) console.log(`[calendar] surfaced ${surfaced} focus-time conflict(s)`);
  return surfaced;
}

// ── Boot + background sync ───────────────────────────────────────────

let syncTimer: ReturnType<typeof setInterval> | null = null;

export async function startCalendarSync() {
  if (!isCalendarConfigured()) {
    console.log("[calendar] no GOOGLE_CLIENT_ID/SECRET — engine dormant");
    return;
  }
  const connected = await isCalendarConnected().catch(() => false);
  console.log(
    connected
      ? "[calendar] connected — syncing every 15 min"
      : "[calendar] creds present, awaiting one-time auth — open /api/calendar/auth"
  );
  if (syncTimer) return;
  // The interval checks connection itself, so completing OAuth mid-run
  // wakes the sync with no restart.
  // Traced like the rest of the spine (CLAUDE.md: "all traced via core/trace.ts")
  // so a 15-min sync that starts failing is visible on /traces, not silent.
  syncTimer = setInterval(() => {
    runTraced("poll", "calendar_sync", () => syncCalendar()).catch((err) =>
      console.warn("[calendar] sync failed:", err?.message ?? err)
    );
  }, 15 * 60 * 1000);
  if (connected)
    runTraced("poll", "calendar_sync", () => syncCalendar()).catch((err) =>
      console.warn("[calendar] initial sync failed:", err?.message ?? err)
    );
}
