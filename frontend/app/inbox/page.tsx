"use client";

// INBOX — triage. Everything captured or proposed lands here untriaged;
// one tap routes it: Today / Next / Later / Done / Drop.

import { useCallback, useEffect, useState } from "react";

type Task = { id: string; title: string; priority: string; domain: string; origin: string };

function localDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function InboxPage() {
  const [tasks, setTasks] = useState<Task[] | null>(null);

  const load = useCallback(async () => {
    const r2 = await fetch("/api/inbox");
    if (r2.ok) setTasks(await r2.json());
  }, []);

  useEffect(() => { load(); }, [load]);

  const route = async (id: string, status: string) => {
    await fetch("/api/today/actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "routeTask", id, status, date: localDate() }),
    });
    await load();
  };

  return (
    <main className="text-aurelius-text max-w-3xl mx-auto space-y-6">
      <header className="flex items-baseline justify-between border-b border-aurelius-gold/35 pb-3">
        <h1 className="aurelius-heading text-4xl">Inbox</h1>
        <span className="text-sm text-neutral-500">{tasks?.length ?? "…"} to triage</span>
      </header>

      {tasks && tasks.length === 0 && (
        <p className="text-neutral-600 italic text-center py-16">Inbox zero. As it should be.</p>
      )}

      <ul className="space-y-3">
        {(tasks ?? []).map((t) => (
          <li key={t.id} className="aurelius-panel-frame p-4">
            <div className="flex items-center justify-between gap-3">
              <span>{t.title}</span>
              {t.origin !== "cole" && (
                <span className="text-[10px] uppercase tracking-wider text-aurelius-gold/70 border border-aurelius-gold/30 rounded px-1.5 py-0.5 shrink-0">proposed</span>
              )}
            </div>
            <div className="flex flex-wrap gap-2 mt-3 text-xs">
              <button onClick={() => route(t.id, "today")} className="border border-aurelius-gold/50 text-aurelius-gold rounded-lg px-3 py-1 hover:bg-aurelius-gold/20 font-medium">Today</button>
              <button onClick={() => route(t.id, "next")} className="border border-aurelius-gold/30 rounded-lg px-3 py-1 hover:bg-aurelius-gold/10 text-neutral-300">Next</button>
              <button onClick={() => route(t.id, "later")} className="border border-aurelius-gold/20 rounded-lg px-3 py-1 hover:bg-aurelius-gold/10 text-neutral-400">Later</button>
              <button onClick={() => route(t.id, "done")} className="border border-emerald-500/40 text-emerald-400 rounded-lg px-3 py-1 hover:bg-emerald-500/15">Done</button>
              <button onClick={() => route(t.id, "abandoned")} className="border border-neutral-700 text-neutral-500 rounded-lg px-3 py-1 hover:bg-neutral-800">Drop</button>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
