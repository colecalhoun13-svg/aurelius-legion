"use client";

// GOALS & PROJECTS — the numbers that must move, one door with three rooms:
// Goals (log progress), Projects (runway), Scoreboard (did the number go
// up — the coach's wall of trends). Same ?tab= pattern as /brain.

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import ProjectsSection from "../../../components/ProjectsSection";
import ScoreboardPanel from "../../../components/goals/ScoreboardPanel";

type Goal = { id: string; name: string; domain: string; horizon: string; progressPct: number; measure: any };

function localDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const HORIZON_ORDER = ["life", "year", "quarter"];
const HORIZON_LABEL: Record<string, string> = { life: "Life", year: "This Year", quarter: "This Quarter" };

function GoalsBody() {
  const [goals, setGoals] = useState<Goal[] | null>(null);
  const [name, setName] = useState("");
  const [targetN, setTargetN] = useState("10");
  const [horizon, setHorizon] = useState("quarter");
  // A failed load must not render as "you have no goals" (final council).
  const [loadFailed, setLoadFailed] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/deck");
      if (res.ok) {
        setGoals((await res.json()).goals);
        setLoadFailed(false);
      } else {
        setLoadFailed(true);
      }
    } catch {
      setLoadFailed(true);
    }
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
    <main className="text-aurelius-text max-w-3xl mx-auto space-y-8 aurelius-stagger">
      <header className="aurelius-rule">
        <h1 className="aurelius-heading text-4xl">Goals</h1>
      </header>

      {loadFailed && goals === null && (
        <p className="text-sm text-amber-300/90 italic">
          Couldn't reach the brain — your goals are safe, they just can't be shown right now.
        </p>
      )}

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
                    <div className="h-full rounded-full aurelius-bar-fill transition-all duration-500" style={{ width: `${g.progressPct}%` }} />
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

const TABS = [
  { key: "goals", label: "Goals" },
  { key: "projects", label: "Projects" },
  { key: "scoreboard", label: "Scoreboard" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

function GoalsInner() {
  const [tab, setTab] = useState<TabKey>("goals");

  // Keyed on the live search params (not mount-once): a ⌘K jump to ?tab=…
  // while ALREADY on this page must switch tabs (same-route nav ≠ remount).
  const searchParams = useSearchParams();
  useEffect(() => {
    const t = searchParams.get("tab");
    if (t && TABS.some((x) => x.key === t)) setTab(t as TabKey);
  }, [searchParams]);

  return (
    <div className="space-y-6">
      <nav className="flex justify-center gap-2 max-w-3xl mx-auto">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`aurelius-heading text-sm tracking-widest px-4 py-2 rounded-lg border min-h-[44px] ${
              tab === t.key
                ? "border-aurelius-gold/70 bg-aurelius-gold/15 text-aurelius-gold"
                : "border-aurelius-gold/20 text-neutral-500 hover:text-aurelius-gold hover:border-aurelius-gold/40"
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>
      {tab === "goals" && <GoalsBody />}
      {tab === "projects" && (
        <main className="text-aurelius-text max-w-3xl mx-auto aurelius-stagger">
          <ProjectsSection />
        </main>
      )}
      {tab === "scoreboard" && <ScoreboardPanel />}
    </div>
  );
}

export default function GoalsPage() {
  return (
    <Suspense fallback={null}>
      <GoalsInner />
    </Suspense>
  );
}
