"use client";

// COMMAND DECK — the three-lane view.
// Left: Cole's lane (focus, goals, habits). Center: the Bridge (signals
// from the background, with inline actions). Right: Aurelius's lane
// (what the system is doing). Hero row on top CONFRONTS — where you're
// behind, not how big the database is. Projects roll across the bottom.

import { useCallback, useEffect, useState } from "react";

type Deck = {
  date: string;
  hero: {
    overdue: number;
    openToday: number;
    doneToday: number;
    followThrough: number | null;
    inbox: number;
    projectsAtRisk: { name: string; daysToTarget: number | null; progressPct: number }[];
    attentionSignals: number;
  };
  plan: { focus: string | null } | null;
  tasks: { id: string; title: string; priority: string }[];
  overdue: { id: string; title: string }[];
  habits: { id: string; name: string; streak: number; doneToday: boolean }[];
  goals: { id: string; name: string; horizon: string; progressPct: number; measure: any }[];
  projects: {
    id: string; name: string; domain: string; priority: string;
    progressPct: number; tasksDone: number; tasksTotal: number;
    daysActive: number; daysToTarget: number | null; needs: string[];
  }[];
  bridge: { id: string; kind: string; severity: string; title: string; body: string; createdAt: string }[];
  activity: {
    counts: { memories24h: number; reasoningRuns24h: number };
    recentPatterns: { patternType: string; status: string; supportCount: number; domain: string }[];
    recentResearch: { summary: string }[];
  };
};

function localDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const SEV: Record<string, string> = {
  critical: "text-red-400 border-red-400/50",
  attention: "text-amber-400 border-amber-400/50",
  notice: "text-aurelius-gold border-aurelius-gold/50",
  info: "text-neutral-400 border-aurelius-gold/25",
};

function Panel({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`aurelius-panel-frame p-5 ${className}`}>
      <h2 className="aurelius-heading text-base mb-3">{title}</h2>
      {children}
    </section>
  );
}

function HeroTile({ label, value, alarm }: { label: string; value: string | number; alarm?: boolean }) {
  return (
    <div className="aurelius-panel-frame px-5 py-3 text-center min-w-[130px]">
      <div className={`text-2xl font-semibold ${alarm ? "text-red-400" : "text-aurelius-gold"}`}>{value}</div>
      <div className="text-[11px] uppercase tracking-widest text-neutral-500 mt-1">{label}</div>
    </div>
  );
}

export default function DeckPage() {
  const [deck, setDeck] = useState<Deck | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newProject, setNewProject] = useState("");
  const [newGoal, setNewGoal] = useState("");
  const [newGoalTarget, setNewGoalTarget] = useState("10");

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/deck?date=${localDate()}`);
      if (!res.ok) throw new Error(`${res.status}`);
      setDeck(await res.json());
      setError(null);
    } catch (e: any) {
      setError(`Couldn't reach the backend (${e?.message}).`);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const act = useCallback(async (payload: Record<string, any>) => {
    await fetch("/api/today/actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: localDate(), ...payload }),
    });
    await load();
  }, [load]);

  if (error) return <main className="p-8 text-red-400">{error}</main>;
  if (!deck) return <main className="p-8 text-neutral-500">Assembling the deck…</main>;

  const h = deck.hero;

  return (
    <main className="text-aurelius-text space-y-6">
      <header className="flex items-baseline justify-between border-b border-aurelius-gold/35 pb-3">
        <h1 className="aurelius-heading text-4xl">Command Deck</h1>
        <span className="text-sm text-neutral-400">{deck.date}</span>
      </header>

      {/* Hero — the confrontation row */}
      <div className="flex flex-wrap gap-3">
        <HeroTile label="Overdue" value={h.overdue} alarm={h.overdue > 0} />
        <HeroTile label="Open today" value={h.openToday} />
        <HeroTile label="Done today" value={h.doneToday} />
        <HeroTile label="Follow-through 7d" value={h.followThrough !== null ? `${h.followThrough}%` : "—"} alarm={h.followThrough !== null && h.followThrough < 50} />
        <HeroTile label="Inbox" value={h.inbox} />
        <HeroTile label="Needs attention" value={h.attentionSignals} alarm={h.attentionSignals > 0} />
      </div>
      {h.projectsAtRisk.length > 0 && (
        <p className="text-sm text-red-400">
          ⚠ At risk: {h.projectsAtRisk.map((p) => `${p.name} (${p.progressPct}% with ${p.daysToTarget}d left)`).join(" · ")}
        </p>
      )}

      {/* Three lanes */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.15fr_1fr] gap-4 items-start">
        {/* Cole's lane */}
        <div className="space-y-4">
          <Panel title="Focus">
            <p className={deck.plan?.focus ? "" : "text-neutral-600 italic"}>
              {deck.plan?.focus || "No focus set — do it on Today."}
            </p>
            {deck.tasks.length > 0 && (
              <ul className="mt-3 space-y-1 text-sm text-neutral-300">
                {deck.tasks.slice(0, 5).map((t) => <li key={t.id}>• {t.title}</li>)}
              </ul>
            )}
          </Panel>

          <Panel title="Goals">
            <div className="space-y-3">
              {deck.goals.length === 0 && <p className="text-neutral-600 italic text-sm">No goals yet. Set one below.</p>}
              {deck.goals.map((g) => (
                <div key={g.id}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span>{g.name} <span className="text-neutral-500 text-xs">({g.horizon})</span></span>
                    <span className="flex items-center gap-2">
                      <span className="text-aurelius-gold">{g.progressPct}%</span>
                      <button onClick={() => act({ action: "bumpGoal", id: g.id })}
                        className="text-xs border border-aurelius-gold/40 rounded px-1.5 hover:bg-aurelius-gold/20" title="Log progress">+1</button>
                    </span>
                  </div>
                  <div className="h-1.5 bg-black/60 rounded overflow-hidden border border-aurelius-gold/15">
                    <div className="h-full bg-gradient-to-r from-aurelius-gold/70 to-aurelius-gold" style={{ width: `${g.progressPct}%` }} />
                  </div>
                </div>
              ))}
              <div className="flex gap-2 pt-1">
                <input value={newGoal} onChange={(e) => setNewGoal(e.target.value)} placeholder="New goal…"
                  className="flex-1 bg-black/40 border border-aurelius-gold/20 rounded px-2 py-1.5 text-sm" />
                <input value={newGoalTarget} onChange={(e) => setNewGoalTarget(e.target.value)} placeholder="target"
                  className="w-16 bg-black/40 border border-aurelius-gold/20 rounded px-2 py-1.5 text-sm text-center" />
                <button onClick={() => { if (newGoal.trim()) { act({ action: "createGoal", name: newGoal.trim(), target: Number(newGoalTarget) || 1 }); setNewGoal(""); } }}
                  className="px-3 bg-aurelius-gold text-black text-sm font-semibold rounded">Add</button>
              </div>
            </div>
          </Panel>

          <Panel title="Habits">
            <div className="flex flex-wrap gap-2">
              {deck.habits.map((hb) => (
                <button key={hb.id} onClick={() => !hb.doneToday && act({ action: "completeHabit", id: hb.id })}
                  className={`px-3 py-1 rounded-full text-sm border ${hb.doneToday ? "bg-aurelius-gold text-black border-aurelius-gold font-semibold" : "border-aurelius-gold/30 hover:border-aurelius-gold"}`}>
                  {hb.doneToday ? "✓ " : ""}{hb.name}{hb.streak > 1 ? ` · ${hb.streak}` : ""}
                </button>
              ))}
              {deck.habits.length === 0 && <p className="text-neutral-600 italic text-sm">No habits yet.</p>}
            </div>
          </Panel>
        </div>

        {/* The Bridge */}
        <Panel title="The Bridge" className="min-h-[300px]">
          {deck.bridge.length === 0 ? (
            <p className="text-neutral-600 italic text-sm">Quiet. Signals from Aurelius's background work land here.</p>
          ) : (
            <ul className="space-y-3">
              {deck.bridge.map((s) => (
                <li key={s.id} className={`border rounded p-3 bg-black/40 ${SEV[s.severity] ?? SEV.info}`}>
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm font-medium">{s.title}</span>
                    <span className="text-[10px] uppercase tracking-wider opacity-70 shrink-0">{s.kind.replace("_", " ")}</span>
                  </div>
                  {s.body && <p className="text-xs text-neutral-400 mt-1 whitespace-pre-line line-clamp-4">{s.body}</p>}
                  <div className="flex gap-2 mt-2">
                    <button onClick={() => act({ action: "ackSignal", id: s.id, status: "acknowledged" })}
                      className="text-xs border border-aurelius-gold/40 rounded px-2 py-0.5 hover:bg-aurelius-gold/20 text-aurelius-gold">Got it</button>
                    <button onClick={() => act({ action: "ackSignal", id: s.id, status: "dismissed" })}
                      className="text-xs border border-neutral-600 rounded px-2 py-0.5 hover:bg-neutral-800 text-neutral-400">Dismiss</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {/* Aurelius's lane */}
        <div className="space-y-4">
          <Panel title="Aurelius — Last 24h">
            <div className="grid grid-cols-2 gap-3 text-center">
              <div>
                <div className="text-xl text-aurelius-gold font-semibold">{deck.activity.counts.memories24h}</div>
                <div className="text-[10px] uppercase tracking-widest text-neutral-500">Memories written</div>
              </div>
              <div>
                <div className="text-xl text-aurelius-gold font-semibold">{deck.activity.counts.reasoningRuns24h}</div>
                <div className="text-[10px] uppercase tracking-widest text-neutral-500">Reasoning runs</div>
              </div>
            </div>
          </Panel>

          <Panel title="Compiled Patterns">
            {deck.activity.recentPatterns.length === 0 ? (
              <p className="text-neutral-600 italic text-sm">Nothing compiled yet — patterns emerge as sessions repeat.</p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {deck.activity.recentPatterns.map((p, i) => (
                  <li key={i} className="text-neutral-300">
                    <span className="text-aurelius-gold">{p.patternType}</span> · {p.domain} · {p.supportCount}× <span className="text-neutral-500 text-xs">({p.status})</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Research Memory">
            {deck.activity.recentResearch.length === 0 ? (
              <p className="text-neutral-600 italic text-sm">Weekend pass runs Sundays 09:00 — findings land here.</p>
            ) : (
              <ul className="space-y-2 text-xs text-neutral-400">
                {deck.activity.recentResearch.map((r, i) => <li key={i}>• {r.summary}</li>)}
              </ul>
            )}
          </Panel>

          <Panel title="The Pulse">
            <ul className="text-xs text-neutral-400 space-y-1">
              <li>• Nightly close-out — 21:30</li>
              <li>• Weekend research — Sun 09:00</li>
            </ul>
          </Panel>
        </div>
      </div>

      {/* Projects — full width */}
      <Panel title={`Projects — ${deck.projects.length}`}>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {deck.projects.map((p) => (
            <div key={p.id} className="border border-aurelius-gold/25 rounded p-4 bg-black/40">
              <div className="flex items-baseline justify-between">
                <span className="font-medium">{p.name}</span>
                <span className="text-xs text-neutral-500">{p.domain}</span>
              </div>
              <div className="h-1.5 bg-black/60 rounded overflow-hidden border border-aurelius-gold/15 my-2">
                <div className="h-full bg-gradient-to-r from-aurelius-gold/70 to-aurelius-gold" style={{ width: `${p.progressPct}%` }} />
              </div>
              <div className="text-xs text-neutral-400 flex justify-between">
                <span>{p.tasksDone}/{p.tasksTotal} tasks · {p.progressPct}%</span>
                <span>day {p.daysActive}{p.daysToTarget !== null ? ` · ${p.daysToTarget}d left` : ""}</span>
              </div>
              {p.needs.length > 0 && (
                <div className="mt-2 text-xs">
                  <span className="text-aurelius-gold/80">Needs:</span>
                  <ul className="text-neutral-400 mt-0.5 space-y-0.5">
                    {p.needs.map((n, i) => <li key={i}>· {n}</li>)}
                  </ul>
                </div>
              )}
            </div>
          ))}
          <div className="border border-dashed border-aurelius-gold/25 rounded p-4 bg-black/20 flex items-center gap-2">
            <input value={newProject} onChange={(e) => setNewProject(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && newProject.trim()) { act({ action: "createProject", name: newProject.trim() }); setNewProject(""); } }}
              placeholder="New project…" className="flex-1 bg-black/40 border border-aurelius-gold/20 rounded px-3 py-2 text-sm" />
            <button onClick={() => { if (newProject.trim()) { act({ action: "createProject", name: newProject.trim() }); setNewProject(""); } }}
              className="px-3 py-2 bg-aurelius-gold text-black text-sm font-semibold rounded">Add</button>
          </div>
        </div>
      </Panel>
    </main>
  );
}
