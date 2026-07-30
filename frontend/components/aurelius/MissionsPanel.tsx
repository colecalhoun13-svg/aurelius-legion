"use client";

// AURELIUS — what the system is doing in the background.
// Missions (the autonomy loop), activity counts, compiled patterns,
// research memory, the pulse. Plus the launcher: give it an objective,
// it plans, runs, and reports — the report joins the second brain.

import { useCallback, useEffect, useState } from "react";

type MissionStep = { idx: number; kind: string; input?: string; status: string; error?: string | null };
type Mission = {
  id: string;
  title: string;
  status: string;
  domain: string;
  origin?: string;
  planSummary: string | null;
  createdAt: string;
  finishedAt: string | null;
  corpusDocId?: string | null;
  steps: MissionStep[];
};

type Activity = {
  counts: { memories24h: number; reasoningRuns24h: number };
  recentPatterns: { patternType: string; status: string; supportCount: number; domain: string }[];
  recentResearch: { summary: string; at?: string }[];
  recentSignals: { kind: string; severity: string; title: string; status: string }[];
  missions?: Mission[];
};

const STATUS_COLOR: Record<string, string> = {
  proposed: "text-neutral-500",
  planned: "text-sky-300",
  running: "text-aurelius-gold",
  completed: "text-emerald-400",
  failed: "text-red-400",
  cancelled: "text-neutral-600",
};

const STEP_GLYPH: Record<string, string> = { recall: "❈", research: "☄", synthesize: "✒" };

export default function MissionsPanel() {
  const [activity, setActivity] = useState<Activity | null>(null);
  const [objective, setObjective] = useState("");
  const [launching, setLaunching] = useState(false);
  const [week, setWeek] = useState<{ acted7: number; undone7: number; pendingNow: number } | null>(null);
  // null = still checking; the pulse dot must not glow green for a dead backend.
  const [alive, setAlive] = useState<boolean | null>(null);
  const [launchError, setLaunchError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/deck");
      if (res.ok) {
        setActivity((await res.json()).activity);
        setAlive(true);
      } else {
        setAlive(false);
      }
    } catch {
      setAlive(false);
    }
  }, []);

  // The week's trust-loop counts — how much got done without Cole touching it.
  useEffect(() => {
    fetch("/api/scoreboard")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j?.autonomy && setWeek(j.autonomy))
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 15000); // live-ish; missions move
    return () => clearInterval(t);
  }, [load]);

  const launch = async () => {
    const text = objective.trim();
    if (!text || launching) return;
    setLaunching(true);
    setLaunchError(null);
    try {
      // Clear the objective ONLY on a confirmed launch — a failed one keeps
      // the text so nothing is silently lost (final council).
      const res = await fetch("/api/missions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ objective: text }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setLaunchError(`Launch failed: ${j.error ?? "try again in a moment"}`);
        return;
      }
      setObjective("");
      await load();
    } catch {
      setLaunchError("Couldn't reach the brain — the mission was not launched.");
    } finally {
      setLaunching(false);
    }
  };

  const missions = activity?.missions ?? [];

  return (
    <main className="text-aurelius-text max-w-3xl mx-auto space-y-6 aurelius-stagger">
      <header className="flex items-baseline justify-between aurelius-rule">
        <h1 className="aurelius-heading text-4xl">Aurelius</h1>
        <span className="flex items-center gap-2.5 text-sm text-neutral-500">
          {alive === false ? (
            <>
              <span className="w-2 h-2 rounded-full bg-red-400/80 shadow-[0_0_8px_rgba(248,113,113,0.6)]" />
              brain unreachable
            </>
          ) : (
            <>
              <span className={`w-2 h-2 rounded-full ${alive ? "aurelius-live-dot bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" : "bg-neutral-600"}`} />
              {alive ? "pulse armed" : "checking…"}
            </>
          )}
        </span>
      </header>

      {/* The week, counted — the trust loop made visible */}
      {week && (
        <p className="text-sm text-neutral-400 -mt-2">
          This week on its own:{" "}
          <span className="text-aurelius-gold font-semibold">{week.acted7}</span> handled ·{" "}
          <span className={week.undone7 > 0 ? "text-amber-300" : "text-neutral-500"}>{week.undone7} undone</span> ·{" "}
          <span className="text-neutral-500">{week.pendingNow} awaiting you</span>
        </p>
      )}

      {/* MISSION LAUNCHER — the autonomy front door */}
      <section className="aurelius-panel-frame p-5 space-y-3">
        <h2 className="aurelius-heading text-lg">Missions</h2>
        <div className="flex gap-3">
          <input
            value={objective}
            onChange={(e) => setObjective(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && launch()}
            placeholder="Give Aurelius an objective — it plans, runs it in the background, and reports…"
            className="flex-1 bg-black/40 border border-aurelius-gold/25 rounded-lg px-3 py-2 text-sm outline-none focus:border-aurelius-gold/60"
          />
          <button
            onClick={launch}
            disabled={launching}
            className="px-5 py-2 bg-aurelius-gold text-black text-sm font-semibold rounded-lg disabled:opacity-40"
          >
            {launching ? "Launching…" : "Launch"}
          </button>
        </div>
        {launchError && <p className="text-xs text-amber-300">{launchError}</p>}

        {missions.length === 0 ? (
          <p className="text-neutral-600 italic text-sm">
            No missions yet. Objectives become plans, plans become reports, reports join the second brain.
          </p>
        ) : (
          <div className="space-y-2.5">
            {missions.map((m) => (
              <div
                key={m.id}
                className={`border rounded-lg px-4 py-3 bg-black/30 transition-colors hover:border-aurelius-gold/40 ${
                  m.status === "running" ? "border-aurelius-gold/40 aurelius-working" : "border-aurelius-gold/15"
                }`}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm font-medium flex-1">
                    {m.title}
                    {m.origin === "aurelius_proposed" && (
                      <span className="ml-2 text-[10px] uppercase tracking-wider text-sky-300 border border-sky-400/40 rounded px-1.5 py-0.5">
                        aurelius proposed
                      </span>
                    )}
                  </span>
                  {m.status === "proposed" ? (
                    <button
                      onClick={async () => {
                        await fetch("/api/missions", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ run: m.id }),
                        });
                        await load();
                      }}
                      className="text-xs border border-emerald-500/40 rounded px-2.5 py-0.5 text-emerald-400 hover:bg-emerald-500/15"
                    >
                      Run ▸
                    </button>
                  ) : (
                    <span className={`text-xs font-semibold ${STATUS_COLOR[m.status] ?? "text-neutral-500"}`}>
                      {m.status}
                    </span>
                  )}
                </div>
                {m.planSummary && <p className="text-xs text-neutral-500 mt-1">{m.planSummary}</p>}
                {m.status === "completed" && m.corpusDocId && (
                  <a
                    href={`/brain?doc=${m.corpusDocId}`}
                    className="inline-block text-xs text-aurelius-gold hover:underline underline-offset-2 mt-1.5"
                  >
                    Read the report →
                  </a>
                )}
                {m.steps.length > 0 && (
                  <div className="flex gap-2 mt-2">
                    {m.steps.map((s) => (
                      <span
                        key={s.idx}
                        title={`${s.kind}: ${s.status}${s.error ? ` — ${s.error}` : ""}`}
                        className={`text-xs px-2 py-0.5 rounded-full border ${
                          s.status === "done"
                            ? "border-emerald-500/40 text-emerald-400"
                            : s.status === "running"
                              ? "border-aurelius-gold/50 text-aurelius-gold animate-pulse"
                              : s.status === "failed"
                                ? "border-red-500/40 text-red-400"
                                : "border-neutral-700 text-neutral-600"
                        }`}
                      >
                        {STEP_GLYPH[s.kind] ?? "·"} {s.kind}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="grid grid-cols-2 gap-4">
        <div className="aurelius-panel-frame p-6 text-center">
          <div className="text-4xl text-aurelius-gold font-semibold drop-shadow-[0_0_14px_rgba(212,175,55,0.3)]">
            {activity?.counts.memories24h ?? "—"}
          </div>
          <div className="text-[11px] uppercase tracking-widest text-neutral-500 mt-2">Memories written · 24h</div>
        </div>
        <div className="aurelius-panel-frame p-6 text-center">
          <div className="text-4xl text-aurelius-gold font-semibold drop-shadow-[0_0_14px_rgba(212,175,55,0.3)]">
            {activity?.counts.reasoningRuns24h ?? "—"}
          </div>
          <div className="text-[11px] uppercase tracking-widest text-neutral-500 mt-2">Reasoning runs · 24h</div>
        </div>
      </div>

      <section className="aurelius-panel-frame p-6">
        <h2 className="aurelius-heading text-lg mb-3">Compiled Patterns</h2>
        {(activity?.recentPatterns ?? []).length === 0 ? (
          <p className="text-neutral-600 italic text-sm">Nothing compiled yet — patterns emerge as situations repeat. This is how Aurelius learns to lean on the LLM less.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {activity!.recentPatterns.map((p, i) => (
              <li key={i} className="text-neutral-300">
                <span className="text-aurelius-gold">{p.patternType}</span> · {p.domain} · seen {p.supportCount}×
                <span className="text-neutral-500 text-xs ml-2">({p.status.replace(/_/g, " ")})</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="aurelius-panel-frame p-6">
        <h2 className="aurelius-heading text-lg mb-3">Research Memory</h2>
        {(activity?.recentResearch ?? []).length === 0 ? (
          <p className="text-neutral-600 italic text-sm">The weekend pass runs Sundays 09:00 — findings and knowledge proposals land here for Monday review.</p>
        ) : (
          <ul className="space-y-2.5 text-sm text-neutral-400">
            {activity!.recentResearch.map((r, i) => <li key={i}>• {r.summary}</li>)}
          </ul>
        )}
      </section>

      <section className="aurelius-panel-frame p-6">
        <h2 className="aurelius-heading text-lg mb-3">The Pulse</h2>
        <ul className="text-sm text-neutral-400 space-y-1.5">
          <li>• <span className="text-neutral-300">Morning briefing</span> — 07:00 · the day opens with a push, not a blank page</li>
          <li>• <span className="text-neutral-300">Nightly debrief</span> — 21:30 · intent vs action, voiced honestly</li>
          <li>• <span className="text-neutral-300">Weekend research</span> — Sun 09:00 · ingests the field, proposes knowledge updates</li>
        </ul>
        <p className="text-xs text-neutral-600 mt-3">Schedules run inside the backend server.</p>
      </section>
    </main>
  );
}
