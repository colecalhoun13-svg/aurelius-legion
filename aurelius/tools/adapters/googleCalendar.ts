// aurelius/tools/adapters/googleCalendar.ts
//
// GOOGLE CALENDAR as a registered tool (OG doc Part VII #4) — Aurelius
// reads the week, finds open blocks, and books time via [TOOL: ...]
// directives in conversation. Creating events is Cole-in-the-loop by
// construction: tool directives only fire from live conversation, never
// from missions or schedulers. Every action fails honestly with the
// connect instruction until the one-time OAuth is done.

import type { ToolAdapter, ToolAdapterResult } from "../types.ts";
import { prisma } from "../../core/db/prisma.ts";
import { isCalendarConnected } from "../../calendar/googleAuth.ts";
import {
  syncCalendar,
  createCalendarEvent,
  deleteCalendarEvent,
  listEventsRange,
  findAvailability,
} from "../../calendar/engine.ts";

const NOT_CONNECTED = "Google Calendar not connected — open /api/calendar/auth once to authorize";

export const googleCalendarAdapter: ToolAdapter = {
  name: "google_calendar",
  description:
    "Google Calendar: read upcoming events, find free time blocks, create events, delete events, force a sync. The calendar is ground truth for Cole's time.",
  actions: [
    {
      name: "read_events",
      description: "Upcoming events from the synced calendar (default: next 7 days).",
      dataSchema: "{ days?: number }",
    },
    {
      name: "find_availability",
      description: "Free blocks in the waking window (08:00–21:00) over the coming days.",
      dataSchema: "{ days?: number, minMinutes?: number (default 60) }",
      example: '[TOOL: google_calendar.find_availability {"days": 3, "minMinutes": 90}]',
    },
    {
      name: "create_event",
      description:
        "Create an event on Cole's primary calendar (only when Cole asked for it in this conversation).",
      dataSchema:
        '{ title: string, start: ISO datetime, end?: ISO datetime, durationMinutes?: number (default 60), description?: string, location?: string }',
      example:
        '[TOOL: google_calendar.create_event {"title": "Deep work — program design", "start": "2026-07-12T09:00:00-05:00", "durationMinutes": 120}]',
    },
    {
      name: "delete_event",
      description:
        "Delete an event from Cole's primary calendar (only when Cole asked for it in this conversation). " +
        "Requires the eventId from read_events — read first, then delete; never guess an id. " +
        "Pass expectTitle to double-check you're deleting the right event.",
      dataSchema: '{ eventId: string, expectTitle?: string }',
      example: '[TOOL: google_calendar.delete_event {"eventId": "abc123", "expectTitle": "Strength — group session"}]',
    },
    {
      name: "sync",
      description: "Pull the latest events from Google now (otherwise every 15 min).",
      dataSchema: "{} (no fields)",
    },
  ],

  async run(action, data): Promise<ToolAdapterResult> {
    if (!(await isCalendarConnected())) {
      return { ok: false, output: null, error: NOT_CONNECTED };
    }
    switch (action) {
      case "read_events": {
        const days = Math.min(Number(data?.days) || 7, 60);
        const events = await listEventsRange(new Date(), new Date(Date.now() + days * 86400_000));
        return {
          ok: true,
          output: {
            summary: `${events.length} events in the next ${days} days`,
            events: events.map((e) => ({
              eventId: e.externalId, // the handle delete_event needs — read, then delete
              title: e.title,
              start: e.startAt.toISOString(),
              end: e.endAt.toISOString(),
              location: e.location ?? undefined,
              allDay: (e.raw as any)?.allDay ?? false,
            })),
          },
        };
      }
      case "find_availability": {
        const days = await findAvailability({
          days: Math.min(Number(data?.days) || 7, 30),
          minMinutes: Number(data?.minMinutes) || 60,
        });
        const totalSlots = days.reduce((n, d) => n + d.slots.length, 0);
        return {
          ok: true,
          output: { summary: `${totalSlots} open blocks across ${days.length} days`, days },
        };
      }
      case "create_event": {
        if (!data?.title || !data?.start) {
          return { ok: false, output: null, error: "title and start (ISO datetime) required" };
        }
        const startAt = new Date(String(data.start));
        if (isNaN(startAt.getTime())) {
          return { ok: false, output: null, error: `unparseable start: ${data.start}` };
        }
        const endAt = data.end
          ? new Date(String(data.end))
          : new Date(startAt.getTime() + (Number(data.durationMinutes) || 60) * 60000);
        // Validate the end the same way we validate the start — an unparseable
        // `end` otherwise sails through as an Invalid Date, and an end at/before
        // the start books a zero/negative-length event.
        if (isNaN(endAt.getTime())) {
          return { ok: false, output: null, error: `unparseable end: ${data.end}` };
        }
        if (endAt.getTime() <= startAt.getTime()) {
          return { ok: false, output: null, error: "end must be after start" };
        }
        const event = await createCalendarEvent({
          title: String(data.title),
          startAt,
          endAt,
          description: data.description ? String(data.description) : undefined,
          location: data.location ? String(data.location) : undefined,
          domain: data.domain ? String(data.domain) : undefined,
        });
        return {
          ok: true,
          output: {
            summary: `"${event.title}" booked ${event.startAt.toISOString()} → ${event.endAt.toISOString()}`,
            eventId: event.externalId,
          },
        };
      }
      case "delete_event": {
        const eventId = data?.eventId ? String(data.eventId) : "";
        if (!eventId) {
          return { ok: false, output: null, error: "eventId required — call read_events first and use its eventId; never guess" };
        }
        // Deleting is destructive — verify against the mirror before touching
        // Google, and cross-check the title when the model supplied one, so a
        // hallucinated or stale id can never take out the wrong session.
        const mirror = await prisma.calendarEvent.findFirst({ where: { externalId: eventId } });
        if (!mirror) {
          return {
            ok: false,
            output: null,
            error: `no event with id ${eventId} in the synced mirror — run read_events for a fresh id (it may already be gone)`,
          };
        }
        if (data?.expectTitle) {
          const want = String(data.expectTitle).trim().toLowerCase();
          const have = (mirror.title ?? "").trim().toLowerCase();
          if (want && !have.includes(want) && !want.includes(have)) {
            return {
              ok: false,
              output: null,
              error: `title mismatch — that id belongs to "${mirror.title}" (${mirror.startAt.toISOString()}), not "${data.expectTitle}". Not deleting; re-check with read_events.`,
            };
          }
        }
        await deleteCalendarEvent(eventId); // honest: throws on real upstream failure
        return {
          ok: true,
          output: { summary: `deleted "${mirror.title}" (${mirror.startAt.toISOString()})`, eventId },
        };
      }
      case "sync": {
        const r = await syncCalendar();
        if (!r.ok) return { ok: false, output: null, error: NOT_CONNECTED };
        return { ok: true, output: { summary: `${r.upserted} events synced, ${r.removed} removed`, ...r } };
      }
      default:
        return { ok: false, output: null, error: `unknown google_calendar action: ${action}` };
    }
  },
};
