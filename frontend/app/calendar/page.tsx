"use client";

// CALENDAR — the week as a resource. Scheduled tasks render on it today;
// Google Calendar events join them when the sync ships (the table and
// adapter seam already exist).

import { useCallback, useEffect, useState } from "react";

type Task = { id: string; title: string; scheduledFor: string | null; status: string };
type CalEvent = { id: string; title: string; startAt: string; endAt: string };

function startOfWeek(d: Date): Date {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // Monday = 0
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function CalendarPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));

  const load = useCallback(async () => {
    const res = await fetch("/api/deck");
    if (res.ok) {
      const d = await res.json();
      setTasks([...(d.tasks ?? []), ...(d.overdue ?? [])]);
      setEvents(d.calendarEvents ?? []);
    }
    const all = await fetch("/api/today"); // includes scheduled tasks for today
    void all;
  }, []);

  useEffect(() => { load(); }, [load]);

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
    <main className="text-aurelius-text max-w-6xl mx-auto space-y-6">
      <header className="flex items-center justify-between border-b border-aurelius-gold/35 pb-3">
        <h1 className="aurelius-heading text-4xl">Calendar</h1>
        <div className="flex items-center gap-3 text-sm">
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
                  {e.startAt.slice(11, 16)} {e.title}
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

      <p className="text-xs text-neutral-600">
        Scheduled tasks render here now. Google Calendar sync lands with the calendar engine —
        the CalendarEvent table and adapter seam are already in place, so events will appear
        on this grid the day it ships.
      </p>
    </main>
  );
}
