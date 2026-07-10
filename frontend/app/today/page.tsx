"use client";

// Today — the first surface of Cole's lane.
// One glanceable column: focus, tasks, habits, capture. The Command Deck
// (two lanes + bridge) comes later; this is the daily driver.

import { useCallback, useEffect, useState } from "react";

type Task = {
  id: string;
  title: string;
  status: string;
  priority: string;
  domain: string;
  dueDate: string | null;
  origin: string;
};

type Habit = {
  id: string;
  name: string;
  streak: number;
  doneToday: boolean;
};

type BridgeSignal = {
  id: string;
  kind: string;
  severity: string;
  title: string;
  body: string;
};

type TodayData = {
  date: string;
  plan: { focus: string | null; headline: string | null } | null;
  tasks: Task[];
  overdue: Task[];
  inboxCount: number;
  doneToday: number;
  habits: Habit[];
  bridgeSignals: BridgeSignal[];
};

function localDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

const PRIORITY_COLOR: Record<string, string> = {
  critical: "text-red-400",
  high: "text-aurelius-gold",
  normal: "text-aurelius-text",
  low: "text-neutral-500",
};

export default function TodayPage() {
  const [data, setData] = useState<TodayData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newTask, setNewTask] = useState("");
  const [captureText, setCaptureText] = useState("");
  const [focusDraft, setFocusDraft] = useState("");
  const [editingFocus, setEditingFocus] = useState(false);
  const [captured, setCaptured] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/today?date=${localDate()}`);
      if (!res.ok) throw new Error(`${res.status}`);
      const json = await res.json();
      setData(json);
      setFocusDraft(json.plan?.focus ?? "");
      setError(null);
    } catch (e: any) {
      setError(`Couldn't reach the backend (${e?.message}). Is the database configured?`);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const act = useCallback(
    async (payload: Record<string, any>) => {
      await fetch("/api/today/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: localDate(), ...payload }),
      });
      await load();
    },
    [load]
  );

  const addTask = async () => {
    const title = newTask.trim();
    if (!title) return;
    setNewTask("");
    await act({ action: "createTask", title, status: "today" });
  };

  const capture = async () => {
    const content = captureText.trim();
    if (!content) return;
    setCaptureText("");
    await act({ action: "capture", content });
    setCaptured(true);
    setTimeout(() => setCaptured(false), 2000);
  };

  const saveFocus = async () => {
    setEditingFocus(false);
    await act({ action: "setPlan", focus: focusDraft.trim() });
  };

  if (error) {
    return (
      <main className="text-aurelius-text p-8">
        <p className="text-red-400">{error}</p>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="text-aurelius-text p-8">
        <p className="text-neutral-500">Loading today…</p>
      </main>
    );
  }

  return (
    <main className="text-aurelius-text">
      <div className="max-w-3xl mx-auto space-y-8">
        {/* Header */}
        <header className="flex items-baseline justify-between border-b border-aurelius-gold/35 pb-4">
          <div>
            <h1 className="aurelius-heading text-4xl">Today</h1>
            <p className="text-sm text-neutral-400">{data.date}</p>
          </div>
          <div className="text-sm text-neutral-400 space-x-4">
            <span>
              <span className="text-aurelius-gold font-semibold">{data.doneToday}</span> done
            </span>
            <span>
              <span className="text-aurelius-gold font-semibold">{data.inboxCount}</span> in inbox
            </span>
          </div>
        </header>

        {/* Focus */}
        <section className="aurelius-panel-frame p-5">
          <h2 className="aurelius-heading text-base mb-2">Focus</h2>
          {editingFocus ? (
            <div className="flex gap-2">
              <input
                autoFocus
                value={focusDraft}
                onChange={(e) => setFocusDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && saveFocus()}
                className="flex-1 bg-black/40 border border-aurelius-border rounded px-3 py-2 text-aurelius-text"
                placeholder="What is today about?"
              />
              <button
                onClick={saveFocus}
                className="px-4 py-2 bg-aurelius-gold text-black font-semibold rounded"
              >
                Set
              </button>
            </div>
          ) : (
            <p
              onClick={() => setEditingFocus(true)}
              className={`cursor-pointer text-lg ${
                data.plan?.focus ? "text-aurelius-text" : "text-neutral-600 italic"
              }`}
            >
              {data.plan?.focus || "Click to set today's focus."}
            </p>
          )}
        </section>

        {/* Bridge signals (only when Aurelius has something for Cole) */}
        {data.bridgeSignals.length > 0 && (
          <section className="aurelius-panel-frame p-5 !border-aurelius-gold/50">
            <h2 className="aurelius-heading text-base mb-3">
              From Aurelius
            </h2>
            <ul className="space-y-2">
              {data.bridgeSignals.map((s) => (
                <li key={s.id} className="text-sm">
                  <span className="text-aurelius-gold">[{s.severity}]</span> {s.title}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Overdue */}
        {data.overdue.length > 0 && (
          <section className="aurelius-panel-frame p-5 !border-red-900/60">
            <h2 className="aurelius-heading text-base mb-3 !text-red-400">
              Overdue — {data.overdue.length}
            </h2>
            <ul className="space-y-2">
              {data.overdue.map((t) => (
                <li key={t.id} className="flex items-center gap-3 text-sm">
                  <button
                    onClick={() => act({ action: "completeTask", id: t.id })}
                    className="w-4 h-4 border border-red-400 rounded-sm hover:bg-red-400/30 shrink-0"
                    title="Complete"
                  />
                  <span>{t.title}</span>
                  <span className="text-neutral-500 text-xs ml-auto shrink-0">
                    due {t.dueDate?.slice(0, 10)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Tasks */}
        <section className="aurelius-panel-frame p-5">
          <h2 className="aurelius-heading text-base mb-3">
            Tasks — {data.tasks.length}
          </h2>
          <ul className="divide-y divide-aurelius-gold/10 mb-4">
            {data.tasks.length === 0 && (
              <li className="text-neutral-600 italic text-sm">Nothing on deck. Add something.</li>
            )}
            {data.tasks.map((t) => (
              <li key={t.id} className="flex items-center gap-3 py-2.5">
                <button
                  onClick={() => act({ action: "completeTask", id: t.id })}
                  className="w-4 h-4 border border-aurelius-gold rounded-sm hover:bg-aurelius-gold/40 shrink-0"
                  title="Complete"
                />
                <span className={PRIORITY_COLOR[t.priority] ?? "text-aurelius-text"}>
                  {t.title}
                </span>
                {t.origin !== "cole" && (
                  <span className="text-xs text-neutral-500 border border-aurelius-border rounded px-1">
                    proposed
                  </span>
                )}
                <span className="text-xs text-neutral-600 ml-auto shrink-0">{t.domain}</span>
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <input
              value={newTask}
              onChange={(e) => setNewTask(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addTask()}
              className="flex-1 bg-black/40 border border-aurelius-border rounded px-3 py-2 text-sm"
              placeholder="Add a task for today…"
            />
            <button
              onClick={addTask}
              className="px-4 py-2 bg-aurelius-gold text-black text-sm font-semibold rounded"
            >
              Add
            </button>
          </div>
        </section>

        {/* Habits */}
        <section className="aurelius-panel-frame p-5">
          <h2 className="aurelius-heading text-base mb-3">Habits</h2>
          {data.habits.length === 0 ? (
            <p className="text-neutral-600 italic text-sm">No habits yet.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {data.habits.map((h) => (
                <button
                  key={h.id}
                  onClick={() => !h.doneToday && act({ action: "completeHabit", id: h.id })}
                  className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                    h.doneToday
                      ? "bg-aurelius-gold text-black border-aurelius-gold font-semibold"
                      : "border-aurelius-border text-aurelius-text hover:border-aurelius-gold"
                  }`}
                >
                  {h.doneToday ? "✓ " : ""}
                  {h.name}
                  {h.streak > 1 ? ` · ${h.streak}` : ""}
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Quick capture */}
        <section className="aurelius-panel-frame p-5">
          <h2 className="aurelius-heading text-base mb-3">
            Capture {captured && <span className="text-aurelius-gold normal-case">— saved ✓</span>}
          </h2>
          <div className="flex gap-2">
            <textarea
              value={captureText}
              onChange={(e) => setCaptureText(e.target.value)}
              rows={2}
              className="flex-1 bg-black/40 border border-aurelius-border rounded px-3 py-2 text-sm resize-none"
              placeholder="Brain-dump anything. It lands in the second brain, searchable forever."
            />
            <button
              onClick={capture}
              className="px-4 self-stretch bg-aurelius-gold text-black text-sm font-semibold rounded"
            >
              Save
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
