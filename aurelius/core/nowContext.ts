// THE NOW LAYER (Layer 2.4 — final council). The brain knows what time it
// is. Before this, prompt assembly carried persona, identity, memory, recall,
// corpus, and tools — and not one layer contained the current date, the time
// of day, or the fact that Cole has a meeting in twenty minutes. Every chat
// turn on every surface now opens with a small, cheap situational block:
// clock, next events with countdowns, today's load, active grants.
//
// Cost discipline (the efficiency seat is watching): the DB-derived body is
// cached for 60s — the clock line is computed fresh on every call, so the
// model's sense of "now" never staleness-drifts by more than a minute.

import { prisma } from "./db/prisma.ts";
import { operatorTimeZone, operatorDayRange } from "./time.ts";

const TTL_MS = 60_000;
let cached: { at: number; body: string } | null = null;

function clockLine(now: Date): string {
  try {
    return now.toLocaleString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: operatorTimeZone(),
    });
  } catch {
    return now.toISOString();
  }
}

function countdown(ms: number): string {
  const min = Math.round(ms / 60_000);
  if (min < 1) return "starting now";
  if (min < 60) return `in ${min} min`;
  const h = Math.floor(min / 60);
  const rem = min % 60;
  return rem > 0 ? `in ${h} h ${rem} min` : `in ${h} h`;
}

function localTime(d: Date): string {
  try {
    return d.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: operatorTimeZone(),
    });
  } catch {
    return d.toISOString().slice(11, 16);
  }
}

async function buildBody(now: Date): Promise<string> {
  // TZ-correct day window (2026-08-11 council) — and it MUST match the start
  // that upsertTodayPlan/dayRange store the dailyPlan under, or the plan lookup
  // below (where: { date: start }) silently misses on any non-UTC deploy.
  const { dstr, start, end } = operatorDayRange();
  const lines: string[] = [];

  const [events, openToday, overdue, plan, grants] = await Promise.all([
    prisma.calendarEvent.findMany({
      where: { startAt: { gte: now, lte: new Date(now.getTime() + 48 * 3600_000) } },
      orderBy: { startAt: "asc" },
      take: 3,
      select: { title: true, startAt: true, raw: true },
    }),
    prisma.task.count({
      where: {
        status: { notIn: ["done", "abandoned"] },
        OR: [{ status: "today" }, { scheduledFor: { gte: start, lt: end } }],
      },
    }),
    prisma.task.count({
      where: { dueDate: { lt: start }, status: { notIn: ["done", "abandoned"] } },
    }),
    prisma.dailyPlan.findUnique({ where: { date: start }, select: { focus: true } }),
    prisma.autonomyGrant.findMany({ where: { status: "active" }, select: { actionClass: true } }),
  ]);

  if (plan?.focus?.trim()) lines.push(`Today's focus: ${plan.focus.trim()}`);
  lines.push(`Task load: ${openToday} on today's deck, ${overdue} overdue.`);

  if (events.length > 0) {
    lines.push("Coming up on the calendar:");
    for (const e of events) {
      const allDay = (e.raw as any)?.allDay;
      lines.push(
        allDay
          ? `  • ${e.title} (all day, ${String(e.startAt.toISOString()).slice(0, 10)})`
          : `  • ${e.title} — ${localTime(e.startAt)} (${countdown(e.startAt.getTime() - now.getTime())})`
      );
    }
  }

  if (grants.length > 0) {
    lines.push(`Standing grants (act without asking, inward only): ${grants.map((g) => g.actionClass).join(", ")}.`);
  }

  return lines.join("\n");
}

/** The NOW block for prompt assembly. Empty string on any failure — the
 *  layer is situational garnish and must never take a chat turn down. */
export async function buildNowBlock(): Promise<string> {
  const now = new Date();
  let body = "";
  try {
    if (cached && now.getTime() - cached.at < TTL_MS) {
      body = cached.body;
    } else {
      body = await buildBody(now);
      cached = { at: now.getTime(), body };
    }
  } catch {
    // DB napping → the clock line alone still grounds the turn.
  }
  const head = `═══ NOW ═══\nIt is ${clockLine(now)}${operatorTimeZone() ? ` (${operatorTimeZone()})` : ""}.`;
  return body ? `${head}\n${body}` : head;
}
