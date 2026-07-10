"use client";

// GOALS — big and small, grouped by horizon, with progress logging.

import { useCallback, useEffect, useState } from "react";

type Goal = { id: string; name: string; domain: string; horizon: string; progressPct: number; measure: any };

function localDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const HORIZON_ORDER = ["life", "year", "quarter"];
const HORIZON_LABEL: Record<string, string> = { life: "Life", year: "This Year", quarter: "This Quarter" };

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[] | null>(null);
  const [name, setName] = useState("");
  const [targetN, setTargetN] = useState("10");
  const [horizon, setHorizon] = useState("quarter");

  const load = useCallback(async () => {
    const res = await fetch("/api/deck");
    if (res.ok) setGoals((await res.json()).goals);
  }, []);

  useEffect(() => { load(); }, [load]);

  const act = async (payload: Record<string, any>) => {
    await fetch("/api/today/actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: localDate(), ...payload }),
    });
    await load();
  };

  const grouped = HORIZON_ORDER.map((hz) => ({
    horizon: hz,
    items: (goals ?? []).filter((g) => g.horizon === hz),
  })).filter((g) => g.items.length > 0);

  return (
    <main className="text-aurelius-text max-w-3xl mx-auto space-y-8">
      <header className="border-b border-aurelius-gold/35 pb-3">
        <h1 className="aurelius-heading text-4xl">Goals</h1>
      </header>

      {grouped.map((grp) => (
        <section key={grp.horizon} className="aurelius-panel-frame p-6">
          <h2 className="aurelius-heading text-lg mb-4">{HORIZON_LABEL[grp.horizon] ?? grp.horizon}</h2>
          <div className="space-y-5">
            {grp.items.map((g) => {
              const m = g.measure ?? {};
              return (
                <div key={g.id}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span>{g.name}</span>
                    <span className="flex items-center gap-3 text-sm">
                      <span className="text-neutral-500">{m.current ?? 0}/{m.target ?? 1}{m.unit ? ` ${m.unit}` : ""}</span>
                      <span className="text-aurelius-gold font-semibold">{g.progressPct}%</span>
                      <button onClick={() => act({ action: "bumpGoal", id: g.id })}
                        className="border border-aurelius-gold/40 rounded px-2 py-0.5 text-xs hover:bg-aurelius-gold/20 text-aurelius-gold">+1</button>
                    </span>
                  </div>
                  <div className="h-2.5 bg-black/60 rounded-full overflow-hidden border border-aurelius-gold/15">
                    <div className="h-full rounded-full bg-gradient-to-r from-aurelius-gold/70 to-aurelius-gold transition-all duration-500" style={{ width: `${g.progressPct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}

      <section className="aurelius-panel-frame p-6 border-dashed">
        <h2 className="aurelius-heading text-lg mb-4">New Goal</h2>
        <div className="flex flex-wrap gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="What are you after?"
            className="flex-1 min-w-[200px] bg-black/40 border border-aurelius-gold/25 rounded-lg px-3 py-2 text-sm" />
          <input value={targetN} onChange={(e) => setTargetN(e.target.value)} placeholder="target"
            className="w-20 bg-black/40 border border-aurelius-gold/25 rounded-lg px-2 py-2 text-sm text-center" />
          <select value={horizon} onChange={(e) => setHorizon(e.target.value)}
            className="bg-black/40 border border-aurelius-gold/25 rounded-lg px-2 py-2 text-sm text-neutral-300">
            <option value="quarter">quarter</option>
            <option value="year">year</option>
            <option value="life">life</option>
          </select>
          <button onClick={() => { if (name.trim()) { act({ action: "createGoal", name: name.trim(), target: Number(targetN) || 1, horizon }); setName(""); } }}
            className="px-4 py-2 bg-aurelius-gold text-black text-sm font-semibold rounded-lg">Add</button>
        </div>
      </section>
    </main>
  );
}
