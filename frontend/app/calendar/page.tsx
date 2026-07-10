"use client";

// CALENDAR — the week as a resource. Google Calendar events render for
// whatever week is in view (synced every 15 min by the backend engine);
// scheduled tasks share the grid. Until the one-time OAuth is done, the
// footer carries the connect link instead of pretending.

import { useCallback, useEffect, useState } from "react";

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
const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:3001";

export default function CalendarPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [connected, setConnected] = useState<boolean | null>(null);
  const [configured, setConfigured] = useState(false);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));

  const loadTasks = useCallback(async () => {
    const res = await fetch("/api/deck");
    if (res.ok) {
      const d = await res.json();
      setTasks([...(d.tasks ?? []), ...(d.overdue ?? [])]);
    }
  }, []);

  const loadEvents = useCallback(async () => {
    const from = weekStart.toISOString();
    const to = new Date(weekStart.getTime() + 7 * 86400000).toISOString();
    const res = await fetch(`/api/calendar?from=${from}&to=${to}`);
    if (res.ok) {
      const d = await res.json();
      setEvents(d.events ?? []);
      setConnected(d.connected ?? false);
      setConfigured(d.configured ?? false);
    }
  }, [weekStart]);

  useEffect(() => { loadTasks(); }, [loadTasks]);
  useEffect(() => { loadEvents(); }, [loadEvents]);

  const days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(weekStart.getTime() + i * 86400000);
    const key = date.toISOString().slice(0, 10);
    const dayTasks = tasks.filter((t) => t.scheduledFor && t.scheduledFor.slice(0, 10) === key);
    const dayEvents = events.filter((e) => e.startAt.slice(0, 10) === key);
    const isToday = key === new Date().toISOString().slice(0, 10);
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
          <span className="text-neutral-400">{weekStart.toISOString().slice(0, 10)} week</span>
          <button onClick={() => shift(1)} className="border border-aurelius-gold/40 rounded-lg px-3 py-1 hover:bg-aurelius-gold/15 text-aurelius-gold">→</button>
        </div>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
        {days.map((d, i) => (
          <div key={d.key} className={`aurelius-panel-frame p-3 min-h-[160px] ${d.isToday ? "!border-aurelius-gold/80" : ""}`}>
            <div className={`text-xs uppercase tracking-widest mb-2 ${d.isToday ? "text-aurelius-gold" : "text-neutral-500"}`}>
              {DAYS[i]} <span className="opacity-70">{d.date.getDate()}</span>
            </div>
            <div className="space-y-1.5">
              {d.dayEvents.map((e) => (
                <div key={e.id} className="text-xs border border-aurelius-gold/40 rounded px-2 py-1 bg-aurelius-gold/10 text-aurelius-gold">
                  {e.raw?.allDay ? "all day" : e.startAt.slice(11, 16)} {e.title}
                </div>
              ))}
              {d.dayTasks.map((t) => (
                <div key={t.id} className="text-xs border border-aurelius-gold/20 rounded px-2 py-1 bg-black/40 text-neutral-300">
                  {t.title}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {connected === false && (
        <p className="text-xs text-neutral-500">
          {configured ? (
            <>
              Google Calendar credentials are in — one authorization left:{" "}
              <a href={`${BACKEND}/api/calendar/auth`} className="text-aurelius-gold underline underline-offset-2">
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
