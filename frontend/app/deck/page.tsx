"use client";

// COMMAND DECK — the one central page.
// Bento hub: hero confrontation row + glass summary cards. Cards open
// LAYERS (slide-over drawers) with the full content — depth comes to you,
// you never leave the deck. Today keeps its own page as the daily driver.

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
  goals: { id: string; name: string; horizon: string; progressPct: number }[];
  projects: {
    id: string; name: string; domain: string; priority: string;
    progressPct: number; tasksDone: number; tasksTotal: number;
    daysActive: number; daysToTarget: number | null; needs: string[];
  }[];
  bridge: { id: string; kind: string; severity: string; title: string; body: string }[];
  activity: {
    counts: { memories24h: number; reasoningRuns24h: number };
    recentPatterns: { patternType: string; status: string; supportCount: number; domain: string }[];
    recentResearch: { summary: string }[];
  };
};

type Layer = null | "bridge" | "projects" | "aurelius" | "goals";

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

function GoldBar({ pct }: { pct: number }) {
  return (
    <div className="h-1.5 bg-black/60 rounded-full overflow-hidden border border-aurelius-gold/15">
      <div className="h-full rounded-full bg-gradient-to-r from-aurelius-gold/70 to-aurelius-gold transition-all duration-500" style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function DeckPage() {
  const [deck, setDeck] = useState<Deck | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [layer, setLayer] = useState<Layer>(null);
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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setLayer(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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
  const pendingBridge = deck.bridge.length;

  return (
    <main className="text-aurelius-text space-y-5">
      <header className="flex items-baseline justify-between pb-1">
        <h1 className="aurelius-heading text-4xl">Command Deck</h1>
        <span className="text-sm text-neutral-400">{deck.date}</span>
      </header>

      {/* Hero — the confrontation row */}
      <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: "Overdue", value: h.overdue, alarm: h.overdue > 0 },
          { label: "Open today", value: h.openToday },
          { label: "Done today", value: h.doneToday },
          { label: "Follow-through", value: h.followThrough !== null ? `${h.followThrough}%` : "—", alarm: h.followThrough !== null && h.followThrough < 50 },
          { label: "Inbox", value: h.inbox },
          { label: "Attention", value: h.attentionSignals, alarm: h.attentionSignals > 0 },
        ].map((t) => (
          <div key={t.label} className="aurelius-panel-frame px-3 py-4 text-center">
            <div className={`text-3xl font-semibold ${t.alarm ? "text-red-400 drop-shadow-[0_0_12px_rgba(248,113,113,0.4)]" : "text-aurelius-gold drop-shadow-[0_0_12px_rgba(212,175,55,0.25)]"}`}>{t.value}</div>
            <div className="text-[10px] uppercase tracking-widest text-neutral-500 mt-1.5">{t.label}</div>
          </div>
        ))}
      </div>
      {h.projectsAtRisk.length > 0 && (
        <p className="text-sm text-red-400/90 px-1">
          ⚠ At risk: {h.projectsAtRisk.map((p) => `${p.name} — ${p.progressPct}% with ${p.daysToTarget}d left`).join(" · ")}
        </p>
      )}

      {/* Bento grid — cards open layers */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 items-start">
        {/* Focus / Today — links to the daily driver */}
        <a href="/today" className="aurelius-panel-frame aurelius-card p-5 block xl:col-span-1">
          <div className="flex items-center justify-between mb-3">
            <h2 className="aurelius-heading text-base">Today</h2>
            <span className="text-aurelius-gold/60 text-xs">open →</span>
          </div>
          <p className={`text-lg leading-snug ${deck.plan?.focus ? "" : "text-neutral-600 italic"}`}>
            {deck.plan?.focus || "No focus set yet."}
          </p>
          <ul className="mt-3 space-y-1.5 text-sm text-neutral-400">
            {deck.tasks.slice(0, 3).map((t) => <li key={t.id}>• {t.title}</li>)}
            {deck.tasks.length === 0 && <li className="italic text-neutral-600">Deck is clear.</li>}
          </ul>
          <div className="flex flex-wrap gap-1.5 mt-4">
            {deck.habits.map((hb) => (
              <span key={hb.id} className={`px-2.5 py-0.5 rounded-full text-xs border ${hb.doneToday ? "bg-aurelius-gold text-black border-aurelius-gold font-semibold" : "border-aurelius-gold/30 text-neutral-400"}`}>
                {hb.doneToday ? "✓ " : ""}{hb.name}
              </span>
            ))}
          </div>
        </a>

        {/* The Bridge — teaser card → layer */}
        <div onClick={() => setLayer("bridge")} className="aurelius-panel-frame aurelius-card p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="aurelius-heading text-base">The Bridge</h2>
            <span className="text-xs px-2 py-0.5 rounded-full border border-aurelius-gold/40 text-aurelius-gold">{pendingBridge}</span>
          </div>
          {deck.bridge.length === 0 ? (
            <p className="text-neutral-600 italic text-sm">Quiet. Background signals land here.</p>
          ) : (
            <ul className="space-y-2">
              {deck.bridge.slice(0, 3).map((s) => (
                <li key={s.id} className="text-sm flex items-start gap-2">
                  <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${s.severity === "attention" || s.severity === "critical" ? "bg-red-400" : "bg-aurelius-gold"}`} />
                  <span className="text-neutral-300 line-clamp-2">{s.title}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="text-aurelius-gold/60 text-xs mt-4">open layer →</div>
        </div>

        {/* Aurelius — teaser card → layer */}
        <div onClick={() => setLayer("aurelius")} className="aurelius-panel-frame aurelius-card p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="aurelius-heading text-base">Aurelius</h2>
            <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" title="Pulse armed" />
          </div>
          <div className="grid grid-cols-2 gap-3 text-center mb-3">
            <div>
              <div className="text-2xl text-aurelius-gold font-semibold">{deck.activity.counts.memories24h}</div>
              <div className="text-[10px] uppercase tracking-widest text-neutral-500 mt-0.5">Memories 24h</div>
            </div>
            <div>
              <div className="text-2xl text-aurelius-gold font-semibold">{deck.activity.counts.reasoningRuns24h}</div>
              <div className="text-[10px] uppercase tracking-widest text-neutral-500 mt-0.5">Reasoning 24h</div>
            </div>
          </div>
          <p className="text-xs text-neutral-500">Nightly close-out 21:30 · Research Sun 09:00</p>
          <div className="text-aurelius-gold/60 text-xs mt-3">open layer →</div>
        </div>

        {/* Goals — teaser card → layer */}
        <div onClick={() => setLayer("goals")} className="aurelius-panel-frame aurelius-card p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="aurelius-heading text-base">Goals</h2>
            <span className="text-aurelius-gold/60 text-xs">{deck.goals.length}</span>
          </div>
          <div className="space-y-3">
            {deck.goals.slice(0, 3).map((g) => (
              <div key={g.id}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-neutral-300">{g.name}</span>
                  <span className="text-aurelius-gold">{g.progressPct}%</span>
                </div>
                <GoldBar pct={g.progressPct} />
              </div>
            ))}
            {deck.goals.length === 0 && <p className="text-neutral-600 italic text-sm">No goals set.</p>}
          </div>
          <div className="text-aurelius-gold/60 text-xs mt-4">open layer →</div>
        </div>

        {/* Projects — teaser card (wide) → layer */}
        <div onClick={() => setLayer("projects")} className="aurelius-panel-frame aurelius-card p-5 md:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="aurelius-heading text-base">Projects</h2>
            <span className="text-aurelius-gold/60 text-xs">{deck.projects.length} active</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {deck.projects.slice(0, 4).map((p) => (
              <div key={p.id}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-neutral-300">{p.name}</span>
                  <span className="text-neutral-500 text-xs">
                    {p.daysToTarget !== null ? `${p.daysToTarget}d left` : `day ${p.daysActive}`}
                  </span>
                </div>
                <GoldBar pct={p.progressPct} />
                <div className="text-xs text-neutral-500 mt-1">{p.tasksDone}/{p.tasksTotal} tasks · {p.progressPct}%</div>
              </div>
            ))}
            {deck.projects.length === 0 && <p className="text-neutral-600 italic text-sm">No projects yet.</p>}
          </div>
          <div className="text-aurelius-gold/60 text-xs mt-4">open layer →</div>
        </div>
      </div>

      {/* ── LAYERS ── */}
      {layer && (
        <>
          <div className="aurelius-backdrop fixed inset-0 z-40" onClick={() => setLayer(null)} />
          <aside className="aurelius-drawer fixed right-0 top-0 h-full w-full sm:w-[480px] z-50 overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="aurelius-heading text-2xl">
                {layer === "bridge" ? "The Bridge" : layer === "projects" ? "Projects" : layer === "goals" ? "Goals" : "Aurelius"}
              </h2>
              <button onClick={() => setLayer(null)} className="text-aurelius-gold border border-aurelius-gold/40 rounded-full w-8 h-8 hover:bg-aurelius-gold/20">✕</button>
            </div>

            {layer === "bridge" && (
              <ul className="space-y-3">
                {deck.bridge.length === 0 && <p className="text-neutral-600 italic">Nothing pending.</p>}
                {deck.bridge.map((s) => (
                  <li key={s.id} className={`border rounded-lg p-3 bg-black/40 ${SEV[s.severity] ?? SEV.info}`}>
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm font-medium">{s.title}</span>
                      <span className="text-[10px] uppercase tracking-wider opacity-70 shrink-0">{s.kind.replace(/_/g, " ")}</span>
                    </div>
                    {s.body && <p className="text-xs text-neutral-400 mt-1.5 whitespace-pre-line">{s.body}</p>}
                    <div className="flex gap-2 mt-2.5">
                      <button onClick={() => act({ action: "ackSignal", id: s.id, status: "acknowledged" })} className="text-xs border border-aurelius-gold/40 rounded px-2 py-0.5 hover:bg-aurelius-gold/20 text-aurelius-gold">Got it</button>
                      <button onClick={() => act({ action: "ackSignal", id: s.id, status: "dismissed" })} className="text-xs border border-neutral-600 rounded px-2 py-0.5 hover:bg-neutral-800 text-neutral-400">Dismiss</button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {layer === "projects" && (
              <div className="space-y-4">
                {deck.projects.map((p) => (
                  <div key={p.id} className="border border-aurelius-gold/25 rounded-lg p-4 bg-black/40">
                    <div className="flex items-baseline justify-between">
                      <span className="font-medium">{p.name}</span>
                      <span className="text-xs text-neutral-500">{p.domain}</span>
                    </div>
                    <div className="my-2"><GoldBar pct={p.progressPct} /></div>
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
                <div className="flex gap-2">
                  <input value={newProject} onChange={(e) => setNewProject(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && newProject.trim()) { act({ action: "createProject", name: newProject.trim() }); setNewProject(""); } }}
                    placeholder="New project…" className="flex-1 bg-black/40 border border-aurelius-gold/25 rounded-lg px-3 py-2 text-sm" />
                  <button onClick={() => { if (newProject.trim()) { act({ action: "createProject", name: newProject.trim() }); setNewProject(""); } }}
                    className="px-4 bg-aurelius-gold text-black text-sm font-semibold rounded-lg">Add</button>
                </div>
              </div>
            )}

            {layer === "goals" && (
              <div className="space-y-4">
                {deck.goals.map((g) => (
                  <div key={g.id}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span>{g.name} <span className="text-neutral-500 text-xs">({g.horizon})</span></span>
                      <span className="flex items-center gap-2">
                        <span className="text-aurelius-gold">{g.progressPct}%</span>
                        <button onClick={() => act({ action: "bumpGoal", id: g.id })} className="text-xs border border-aurelius-gold/40 rounded px-1.5 hover:bg-aurelius-gold/20">+1</button>
                      </span>
                    </div>
                    <GoldBar pct={g.progressPct} />
                  </div>
                ))}
                <div className="flex gap-2 pt-2">
                  <input value={newGoal} onChange={(e) => setNewGoal(e.target.value)} placeholder="New goal…" className="flex-1 bg-black/40 border border-aurelius-gold/25 rounded-lg px-3 py-2 text-sm" />
                  <input value={newGoalTarget} onChange={(e) => setNewGoalTarget(e.target.value)} className="w-16 bg-black/40 border border-aurelius-gold/25 rounded-lg px-2 py-2 text-sm text-center" />
                  <button onClick={() => { if (newGoal.trim()) { act({ action: "createGoal", name: newGoal.trim(), target: Number(newGoalTarget) || 1 }); setNewGoal(""); } }}
                    className="px-4 bg-aurelius-gold text-black text-sm font-semibold rounded-lg">Add</button>
                </div>
              </div>
            )}

            {layer === "aurelius" && (
              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-3 text-center">
                  <div className="border border-aurelius-gold/25 rounded-lg p-4 bg-black/40">
                    <div className="text-2xl text-aurelius-gold font-semibold">{deck.activity.counts.memories24h}</div>
                    <div className="text-[10px] uppercase tracking-widest text-neutral-500 mt-1">Memories 24h</div>
                  </div>
                  <div className="border border-aurelius-gold/25 rounded-lg p-4 bg-black/40">
                    <div className="text-2xl text-aurelius-gold font-semibold">{deck.activity.counts.reasoningRuns24h}</div>
                    <div className="text-[10px] uppercase tracking-widest text-neutral-500 mt-1">Reasoning 24h</div>
                  </div>
                </div>
                <div>
                  <h3 className="aurelius-heading text-base mb-2">Compiled Patterns</h3>
                  {deck.activity.recentPatterns.length === 0 ? (
                    <p className="text-neutral-600 italic text-sm">Nothing compiled yet — patterns emerge as sessions repeat.</p>
                  ) : (
                    <ul className="space-y-1.5 text-sm">
                      {deck.activity.recentPatterns.map((p, i) => (
                        <li key={i} className="text-neutral-300"><span className="text-aurelius-gold">{p.patternType}</span> · {p.domain} · {p.supportCount}× <span className="text-neutral-500 text-xs">({p.status})</span></li>
                      ))}
                    </ul>
                  )}
                </div>
                <div>
                  <h3 className="aurelius-heading text-base mb-2">Research Memory</h3>
                  {deck.activity.recentResearch.length === 0 ? (
                    <p className="text-neutral-600 italic text-sm">Weekend pass runs Sundays 09:00 — findings land here.</p>
                  ) : (
                    <ul className="space-y-2 text-xs text-neutral-400">
                      {deck.activity.recentResearch.map((r, i) => <li key={i}>• {r.summary}</li>)}
                    </ul>
                  )}
                </div>
                <div>
                  <h3 className="aurelius-heading text-base mb-2">The Pulse</h3>
                  <ul className="text-xs text-neutral-400 space-y-1">
                    <li>• Nightly close-out — 21:30</li>
                    <li>• Weekend research — Sun 09:00</li>
                  </ul>
                </div>
              </div>
            )}
          </aside>
        </>
      )}
    </main>
  );
}
