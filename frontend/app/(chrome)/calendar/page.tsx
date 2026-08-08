"use client";

// CALENDAR — "today burns". The week as a resource, and a place to ACT on it.
// Google Calendar events render for whatever week is in view (synced every
// 15 min by the backend engine); scheduled tasks share the grid across the
// whole range. Each day takes a quick-add: lead with a time ("3pm Team call")
// and it becomes a real Google event when connected; plain text becomes a
// task pinned to that day. Until the one-time OAuth is done, the footer
// carries the connect link instead of pretending.
//
// ELEVATED IMPERIAL re-dress (docs/REDESIGN_PLAN.md): same fetches, same
// handlers — today's column wears the inscription tablet with a gold
// now-line (client-side clock, never render-time), the other six days stand
// flat on hairlines. Re-dress, never delete.

import { useCallback, useEffect, useState } from "react";
import { backendUrl } from "../../../lib/backendUrl";
import { SparkBars } from "../../../components/viz/Spark";

type Task = { id: string; title: string; scheduledFor: string | null; status: string };
type CalEvent = { id: string; title: string; startAt: string; endAt: string; raw?: { allDay?: boolean } | null };

function startOfWeek(d: Date): Date {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // Monday = 0
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// The inscription day-number (Ⅳ, Ⅻ…) — ceremony, never a sentence.
const ROMAN_PAIRS: Array<[number, string]> = [
  [10, "Ⅹ"], [9, "Ⅸ"], [5, "Ⅴ"], [4, "Ⅳ"], [1, "Ⅰ"],
];
function roman(n: number): string {
  let out = "";
  for (const [v, s] of ROMAN_PAIRS) while (n >= v) { out += s; n -= v; }
  return out;
}

// LOCAL day key + clock time. The API serializes Dates as UTC ISO strings;
// slicing those puts evening events on tomorrow's column and shows UTC clock
// time — Cole lives in his own timezone, so the grid must too.
function localDayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function localTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
}

// The protected-block heuristic: schedule-protection guards training and deep
// work — those events burn gold-bright on the grid.
function isProtected(title: string): boolean {
  return /train|deep work|protected|held/i.test(title);
}

// "3pm Team call" / "15:30 Standup" → a start time + the rest of the line.
function parseLeadTime(text: string): { h: number; m: number; rest: string } | null {
  const m = text.match(/^\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s+(.+)$/i);
  if (!m) return null;
  let h = Number(m[1]);
  const mins = Number(m[2] ?? 0);
  const ap = m[3]?.toLowerCase();
  if (ap === "pm" && h < 12) h += 12;
  if (ap === "am" && h === 12) h = 0;
  if (!ap && !m[2]) return null; // a bare number ("3 sets of squats") isn't a time
  if (h > 23 || mins > 59) return null;
  return { h, m: mins, rest: m[4].trim() };
}

// The event stone — 2px gold-dim spine; protected blocks burn brighter.
function EventChip({ e }: { e: CalEvent }) {
  const hot = isProtected(e.title);
  return (
    <div
      className="rounded-[1px] px-2 py-1 mb-1.5 text-[11.5px]"
      style={{
        borderLeft: `2px solid ${hot ? "var(--gold-bright)" : "var(--gold-dim)"}`,
        background: hot ? "rgba(212,175,55,.10)" : "rgba(212,175,55,.06)",
        color: hot ? "var(--ink)" : "var(--ink2)",
      }}
    >
      <span className="block" style={{ fontFamily: "var(--font-data),Arial,sans-serif", fontSize: 10, letterSpacing: ".06em", color: "var(--ink3)" }}>
        {e.raw?.allDay ? "all day" : localTime(e.startAt)}
      </span>
      {e.title}
    </div>
  );
}

export default function CalendarPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [connected, setConnected] = useState<boolean | null>(null);
  const [configured, setConfigured] = useState(false);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [addingDay, setAddingDay] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [backend, setBackend] = useState("http://localhost:3001");

  useEffect(() => setBackend(backendUrl()), []);

  const [unreachable, setUnreachable] = useState(false);

  // The now-line rides a client-side clock — NEVER a render-time Date, so
  // the server-rendered markup and the hydrated page can't disagree.
  const [nowFrac, setNowFrac] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setNowFrac((d.getHours() * 60 + d.getMinutes()) / 1440);
    };
    tick();
    const t = setInterval(tick, 60_000);
    return () => clearInterval(t);
  }, []);

  const load = useCallback(async () => {
    const from = weekStart.toISOString();
    const to = new Date(weekStart.getTime() + 7 * 86400000).toISOString();
    try {
      const res = await fetch(`/api/calendar?from=${from}&to=${to}`);
      if (res.ok) {
        const d = await res.json();
        setEvents(d.events ?? []);
        setTasks(d.tasks ?? []);
        setConnected(d.connected ?? false);
        setConfigured(d.configured ?? false);
        setUnreachable(false);
      } else {
        setUnreachable(true);
      }
    } catch {
      setUnreachable(true); // an empty week and a dead backend must not look alike
    }
  }, [weekStart]);

  useEffect(() => { load(); }, [load]);

  // Quick-add: a timed line becomes a real event (when Google is connected);
  // anything else becomes a task pinned to that day (noon local, so timezone
  // edges can't push it across midnight).
  const quickAdd = async (date: Date) => {
    const text = draft.trim();
    if (!text || saving) return;
    setSaving(true);
    try {
      const t = parseLeadTime(text);
      if (t && connected) {
        const startAt = new Date(date);
        startAt.setHours(t.h, t.m, 0, 0);
        const endAt = new Date(startAt.getTime() + 60 * 60000);
        const res = await fetch("/api/calendar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: t.rest, startAt: startAt.toISOString(), endAt: endAt.toISOString() }),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          window.alert(`Couldn't add the event: ${j.error ?? res.status}`);
        }
      } else {
        const scheduledFor = new Date(date);
        scheduledFor.setHours(12, 0, 0, 0);
        const res = await fetch("/api/today/actions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "createTask", title: text, status: "next", scheduledFor: scheduledFor.toISOString() }),
        });
        if (!res.ok) window.alert("Couldn't add the task — try again in a moment.");
      }
      setDraft("");
      setAddingDay(null);
      await load();
    } finally {
      setSaving(false);
    }
  };

  const days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(weekStart.getTime() + i * 86400000);
    const key = localDayKey(date);
    const dayTasks = tasks.filter((t) => t.scheduledFor && localDayKey(new Date(t.scheduledFor)) === key);
    // All-day events are stored as UTC midnight — bucketing them through the
    // local clock lands a Wednesday event in Tuesday's column (go-live council).
    const dayEvents = events.filter((e) =>
      e.raw?.allDay ? String(e.startAt).slice(0, 10) === key : localDayKey(new Date(e.startAt)) === key
    );
    const isToday = key === localDayKey(new Date());
    return { date, key, dayTasks, dayEvents, isToday };
  });

  const shift = (weeks: number) =>
    setWeekStart(new Date(weekStart.getTime() + weeks * 7 * 86400000));

  return (
    <div className="au-horizon">
      <div className="max-w-6xl mx-auto pb-12 relative z-[1]">
        <header className="text-center pt-2">
          <h1 className="au-title" style={{ fontSize: "clamp(2rem,5vw,2.6rem)", lineHeight: 1.1, margin: 0 }}>
            The Week
          </h1>
          <div className="flex items-center justify-center gap-3 mt-3 flex-wrap">
            <button
              onClick={() => shift(-1)}
              className="au-btn-ghost"
              style={{ padding: ".3rem .8rem" }}
              aria-label="Previous week"
            >
              ←
            </button>
            <span className="au-kicker">{localDayKey(weekStart)} week</span>
            <button
              onClick={() => shift(1)}
              className="au-btn-ghost"
              style={{ padding: ".3rem .8rem" }}
              aria-label="Next week"
            >
              →
            </button>
            {connected && (
              <span
                className="au-kicker"
                style={{ color: "var(--gold)", border: "1px solid var(--gold-line)", borderRadius: 2, padding: ".15rem .7rem" }}
              >
                Google · synced
              </span>
            )}
          </div>
        </header>

        {unreachable && (
          <p className="au-kicker text-center mt-4" style={{ color: "var(--attn)", display: "block" }}>
            Couldn't reach the brain — this week may not be the whole picture.
          </p>
        )}

        {/* The week's load ribbon (final council graphic): busy hours per day —
            a 7-meeting Tuesday and an empty Friday no longer look identical at
            a glance, and schedule-protection's choices become legible. */}
        {events.length > 0 && (
          <div className="flex items-center gap-3 mt-6">
            <span className="text-[11px] shrink-0" style={{ color: "var(--ink3)" }}>
              load · busy h/day <span style={{ color: "var(--ink3)", opacity: 0.6 }}>(of 12)</span>
            </span>
            <div className="overflow-x-auto">
              <SparkBars
                values={days.map((d) =>
                  Math.min(
                    12,
                    d.dayEvents
                      .filter((e) => !e.raw?.allDay)
                      .reduce((h, e) => h + Math.max(0, (new Date(e.endAt).getTime() - new Date(e.startAt).getTime()) / 3600_000), 0)
                  )
                )}
                labels={DAYS.map((d) => d[0]!)}
                width={340}
                height={44}
                max={12} // absolute anchor — a light week must LOOK light (alignment council)
              />
            </div>
          </div>
        )}

        {/* The week — today wears the glass, the other six stand flat on hairlines. */}
        <div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 mt-6"
          style={{ borderLeft: "1px solid var(--line1)", borderRight: "1px solid var(--line1)" }}
        >
          {days.map((d, i) => (
            <div
              key={d.key}
              className={`relative min-h-[190px] px-2.5 py-3 ${d.isToday ? "au-tablet z-[1] -m-px" : ""}`}
              style={d.isToday ? undefined : { borderRight: "1px solid var(--line1)", borderBottom: "1px solid var(--line1)" }}
            >
              {/* the gold now-line — set by the client clock, only on today */}
              {d.isToday && nowFrac != null && (
                <div
                  className="absolute pointer-events-none"
                  style={{
                    left: 6, right: 6, height: 1, zIndex: 2,
                    top: `${(12 + Math.min(0.96, Math.max(0, nowFrac)) * 84).toFixed(2)}%`,
                    background: "var(--gold-bright)", opacity: 0.8,
                    boxShadow: "0 0 6px rgba(242,211,119,.35)",
                  }}
                  aria-hidden="true"
                >
                  <span
                    className="absolute rounded-full"
                    style={{ left: -2, top: -2.5, width: 6, height: 6, background: "var(--gold-bright)" }}
                  />
                </div>
              )}

              <div className="flex items-baseline justify-between mb-2 relative z-[3]">
                <span
                  className="text-[11.5px] uppercase"
                  style={{
                    fontFamily: "var(--font-body),Georgia,serif", fontWeight: 600, letterSpacing: ".2em",
                    color: d.isToday ? "var(--gold)" : "var(--ink3)",
                  }}
                >
                  {DAYS[i]}{" "}
                  <b style={{ fontFamily: "var(--font-serif),Georgia,serif", fontSize: "1.05rem", color: d.isToday ? "var(--gold)" : "var(--ink2)" }}>
                    {roman(d.date.getDate())}
                  </b>
                </span>
                <button
                  onClick={() => {
                    setDraft("");
                    setAddingDay(addingDay === d.key ? null : d.key);
                  }}
                  className="text-sm leading-none min-w-[24px] min-h-[24px]"
                  style={{ color: "var(--gold-dim)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "var(--gold)")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "var(--gold-dim)")}
                  title="Add to this day — lead with a time for an event"
                >
                  +
                </button>
              </div>

              <div className="relative z-[3]">
                {d.dayEvents.map((e) => (
                  <EventChip key={e.id} e={e} />
                ))}
                {d.dayTasks.map((t) => (
                  <div
                    key={t.id}
                    className="rounded-[1px] px-2 py-1 mb-1.5 text-[11.5px]"
                    style={{ borderLeft: "2px solid var(--line2)", background: "rgba(255,255,255,.03)", color: "var(--ink2)" }}
                  >
                    {t.title}
                  </div>
                ))}
                {addingDay === d.key && (
                  <input
                    autoFocus
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") quickAdd(d.date);
                      if (e.key === "Escape") setAddingDay(null);
                    }}
                    disabled={saving}
                    placeholder={connected ? "“3pm Team call” or a task…" : "Add a task for this day…"}
                    className="w-full rounded-[2px] px-2 py-1.5 text-xs outline-none disabled:opacity-50"
                    style={{ background: "rgba(0,0,0,.4)", border: "1px solid var(--gold-line)", color: "var(--ink)" }}
                  />
                )}
              </div>
            </div>
          ))}
        </div>

        {connected === false && (
          <p className="au-kicker mt-5" style={{ display: "block", fontSize: 13.5 }}>
            {configured ? (
              <>
                Google Calendar credentials are in — one authorization left:{" "}
                <a
                  href={`${backend}/api/calendar/auth`}
                  className="underline underline-offset-2"
                  style={{ color: "var(--gold)", fontStyle: "normal" }}
                >
                  connect Google Calendar
                </a>
                . Events sync every 15 minutes after that.
              </>
            ) : (
              <>Scheduled tasks render here now. Add GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET to wake the Google sync.</>
            )}
          </p>
        )}
      </div>
    </div>
  );
}
