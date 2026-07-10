"use client";

// PROJECTS — every active project: progress, age, runway, what it needs.

import { useCallback, useEffect, useState } from "react";

type Project = {
  id: string; name: string; domain: string; priority: string;
  progressPct: number; tasksDone: number; tasksTotal: number;
  daysActive: number; daysToTarget: number | null; needs: string[];
};

function localDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function GoldBar({ pct }: { pct: number }) {
  return (
    <div className="h-2 bg-black/60 rounded-full overflow-hidden border border-aurelius-gold/15">
      <div className="h-full rounded-full bg-gradient-to-r from-aurelius-gold/70 to-aurelius-gold transition-all duration-500" style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/deck");
    if (res.ok) setProjects((await res.json()).projects);
  }, []);

  useEffect(() => { load(); }, [load]);

  const add = async () => {
    if (!name.trim()) return;
    await fetch("/api/today/actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "createProject",
        name: name.trim(),
        targetDate: target ? new Date(target).toISOString() : undefined,
        date: localDate(),
      }),
    });
    setName(""); setTarget("");
    await load();
  };

  return (
    <main className="text-aurelius-text max-w-5xl mx-auto space-y-6">
      <header className="flex items-baseline justify-between border-b border-aurelius-gold/35 pb-3">
        <h1 className="aurelius-heading text-4xl">Projects</h1>
        <span className="text-sm text-neutral-500">{projects?.length ?? "…"} active</span>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {(projects ?? []).map((p) => (
          <div key={p.id} className="aurelius-panel-frame p-5">
            <div className="flex items-baseline justify-between mb-1">
              <span className="text-lg font-medium">{p.name}</span>
              <span className="text-xs text-neutral-500">{p.domain}</span>
            </div>
            <div className="flex items-center gap-3 my-3">
              <div className="flex-1"><GoldBar pct={p.progressPct} /></div>
              <span className="text-aurelius-gold font-semibold text-sm w-10 text-right">{p.progressPct}%</span>
            </div>
            <div className="flex justify-between text-xs text-neutral-400">
              <span>{p.tasksDone}/{p.tasksTotal} tasks</span>
              <span>day {p.daysActive}{p.daysToTarget !== null ? ` · ${p.daysToTarget}d to target` : ""}</span>
            </div>
            {p.needs.length > 0 && (
              <div className="mt-3 border-t border-aurelius-gold/15 pt-2 text-sm">
                <span className="aurelius-heading text-xs">Needs</span>
                <ul className="text-neutral-400 mt-1 space-y-1">
                  {p.needs.map((n, i) => <li key={i}>· {n}</li>)}
                </ul>
              </div>
            )}
          </div>
        ))}

        <div className="aurelius-panel-frame p-5 border-dashed space-y-3">
          <span className="aurelius-heading text-base">New Project</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name…"
            className="w-full bg-black/40 border border-aurelius-gold/25 rounded-lg px-3 py-2 text-sm" />
          <input value={target} onChange={(e) => setTarget(e.target.value)} type="date"
            className="w-full bg-black/40 border border-aurelius-gold/25 rounded-lg px-3 py-2 text-sm text-neutral-400" />
          <button onClick={add} className="w-full py-2 bg-aurelius-gold text-black text-sm font-semibold rounded-lg">Add project</button>
        </div>
      </div>
    </main>
  );
}
