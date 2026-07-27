"use client";

// CALENDAR — the week as a resource, and a place to ACT on it. Google
// Calendar events render for whatever week is in view (synced every 15 min
// by the backend engine); scheduled tasks share the grid across the whole
// range. Each day takes a quick-add: lead with a time ("3pm Team call") and
// it becomes a real Google event when connected; plain text becomes a task
// pinned to that day. Until the one-time OAuth is done, the footer carries
// the connect link instead of pretending.

import { useCallback, useEffect, useState } from "react";
import { backendUrl } from "../../../lib/backendUrl";

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

// LOCAL day key + clock time. The API serializes Dates as UTC ISO strings;
// slicing those puts evening events on tomorrow's column and shows UTC clock
// time — Cole lives in his own timezone, so the grid must too.
function localDayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function localTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
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

  const load = useCallback(async () => {
    const from = weekStart.toISOString();
    const to = new Date(weekStart.getTime() + 7 * 86400000).toISOString();
    const res = await fetch(`/api/calendar?from=${from}&to=${to}`);
    if (res.ok) {
      const d = await res.json();
      setEvents(d.events ?? []);
      setTasks(d.tasks ?? []);
      setConnected(d.connected ?? false);
      setConfigured(d.configured ?? false);
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
    const dayEvents = events.filter((e) => localDayKey(new Date(e.startAt)) === key);
    const isToday = key === localDayKey(new Date());
    return { date, key, dayTasks, dayEvents, isToday };
  });

  const shift = (weeks: number) =>
    setWeekStart(new Date(weekStart.getTime() + weeks * 7 * 86400000));

  return (
    <main className="text-aurelius-text max-w-6xl mx-auto space-y-6 aurelius-stagger">
      <header className="flex items-center justify-between aurelius-rule">
        <h1 className="aurelius-heading text-4xl">Calendar</h1>
        <div className="flex items-center gap-3 text-sm">
          {connected && (
            <span className="text-xs text-aurelius-gold/80 border border-aurelius-gold/30 rounded-full px-3 py-1">
              Google · synced
            </span>
          )}
          <button onClick={() => shift(-1)} className="border border-aurelius-gold/40 rounded-lg px-3 py-1 hover:bg-aurelius-gold/15 text-aurelius-gold">←</button>
          <span className="text-neutral-400">{localDayKey(weekStart)} week</span>
          <button onClick={() => shift(1)} className="border border-aurelius-gold/40 rounded-lg px-3 py-1 hover:bg-aurelius-gold/15 text-aurelius-gold">→</button>
        </div>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
        {days.map((d, i) => (
          <div key={d.key} className={`aurelius-panel-frame p-3 min-h-[160px] ${d.isToday ? "!border-aurelius-gold/80" : ""}`}>
            <div className="flex items-baseline justify-between mb-2">
              <span className={`text-xs uppercase tracking-widest ${d.isToday ? "text-aurelius-gold" : "text-neutral-500"}`}>
                {DAYS[i]} <span className="opacity-70">{d.date.getDate()}</span>
              </span>
              <button
                onClick={() => {
                  setDraft("");
                  setAddingDay(addingDay === d.key ? null : d.key);
                }}
                className="text-aurelius-gold/50 hover:text-aurelius-gold text-sm leading-none min-w-[24px] min-h-[24px]"
                title="Add to this day — lead with a time for an event"
              >
                +
              </button>
            </div>
            <div className="space-y-1.5">
              {d.dayEvents.map((e) => (
                <div key={e.id} className="text-xs border border-aurelius-gold/40 rounded px-2 py-1 bg-aurelius-gold/10 text-aurelius-gold">
                  {e.raw?.allDay ? "all day" : localTime(e.startAt)} {e.title}
                </div>
              ))}
              {d.dayTasks.map((t) => (
                <div key={t.id} className="text-xs border border-aurelius-gold/20 rounded px-2 py-1 bg-black/40 text-neutral-300">
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
                  className="w-full bg-black/40 border border-aurelius-gold/40 rounded px-2 py-1.5 text-xs outline-none focus:border-aurelius-gold/70 disabled:opacity-50"
                />
              )}
            </div>
          </div>
        ))}
      </div>

      {connected === false && (
        <p className="text-xs text-neutral-500">
          {configured ? (
            <>
              Google Calendar credentials are in — one authorization left:{" "}
              <a href={`${backend}/api/calendar/auth`} className="text-aurelius-gold underline underline-offset-2">
                connect Google Calendar
              </a>
              . Events sync every 15 minutes after that.
            </>
          ) : (
            <>Scheduled tasks render here now. Add GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET to wake the Google sync.</>
          )}
        </p>
      )}
    </main>
  );
}
