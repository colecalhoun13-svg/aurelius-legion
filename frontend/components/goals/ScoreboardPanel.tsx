"use client";

// THE SCOREBOARD — the coach's wall. "Did the number go up," answered in
// one glance: follow-through across weeks, the last fourteen days as bars,
// habit consistency as dot-grids, each goal's pace against its clock, and
// Aurelius's own week (work handled alone, and how much thinking is
// compiled vs rented). Charts start sparse and fill in as weeks accrue —
// short lines are honest lines.

import { useEffect, useState } from "react";
import { SparkLine, SparkBars, DotRow } from "../viz/Spark";

type Week = {
  weekStart: string;
  followThrough: number | null;
  tasksDone: number;
  habitCompletions: number;
  llmDependenceRate: number | null;
  corpusDocsAdded: number;
  patternsActive: number | null;
  corrections: number | null;
  staleKnowledge: number | null;
};
type Habit = { id: string; name: string; streak: number; doneToday: boolean };
type Goal = { id: string; name: string; horizon: string; progressPct: number; measure: any; targetDate?: string | null; createdAt?: string };
type Feed = {
  weeks: Week[];
  doneTimestamps: string[];
  habits: Habit[];
  habitCompletions: { habitId: string; completedAt: string }[];
  goals: Goal[];
  autonomy: { acted7: number; undone7: number; pendingNow: number };
  corpusDates: string[];
};

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** The last `n` local days, oldest first. */
function lastDays(n: number): { key: string; label: string }[] {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.now() - (n - 1 - i) * 86400_000);
    return { key: dayKey(d), label: "SMTWTFS"[d.getDay()]! };
  });
}

export default function ScoreboardPanel() {
  const [feed, setFeed] = useState<Feed | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/scoreboard")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("unreachable"))))
      .then(setFeed)
      .catch(() => setErr("Aurelius couldn't load the scoreboard — try again in a moment."));
  }, []);

  if (err) return <p className="text-sm text-amber-300/90">{err}</p>;
  if (!feed) return <p className="text-sm text-neutral-500">…</p>;

  const days = lastDays(14);
  const doneByDay = new Map(days.map((d) => [d.key, 0]));
  for (const ts of feed.doneTimestamps) {
    const k = dayKey(new Date(ts));
    if (doneByDay.has(k)) doneByDay.set(k, (doneByDay.get(k) ?? 0) + 1);
  }
  const doneBars = days.map((d) => doneByDay.get(d.key) ?? 0);
  const doneTotal14 = doneBars.reduce((a, b) => a + b, 0);

  const habitDays = new Map<string, Set<string>>();
  for (const c of feed.habitCompletions) {
    const set = habitDays.get(c.habitId) ?? new Set<string>();
    set.add(dayKey(new Date(c.completedAt)));
    habitDays.set(c.habitId, set);
  }

  const latest = feed.weeks[feed.weeks.length - 1];
  const ft = feed.weeks.map((w) => w.followThrough);
  const llm = feed.weeks.map((w) => w.llmDependenceRate);

  return (
    <div className="text-aurelius-text max-w-3xl mx-auto space-y-8 aurelius-stagger">
      <header className="aurelius-rule flex items-baseline justify-between">
        <h1 className="aurelius-heading text-4xl">Scoreboard</h1>
        <span className="text-sm text-neutral-500">did the number go up</span>
      </header>

      {/* Hero tiles — this stretch, in three numbers */}
      <div className="grid grid-cols-3 gap-4">
        <div className="aurelius-panel-frame p-5 text-center">
          <div className="text-3xl text-aurelius-gold font-semibold">{doneTotal14}</div>
          <div className="text-[11px] uppercase tracking-widest text-neutral-500 mt-1.5">done · 14 days</div>
        </div>
        <div className="aurelius-panel-frame p-5 text-center">
          <div className="text-3xl text-aurelius-gold font-semibold">
            {latest?.followThrough != null ? `${latest.followThrough}%` : "—"}
          </div>
          <div className="text-[11px] uppercase tracking-widest text-neutral-500 mt-1.5">follow-through</div>
        </div>
        <div className="aurelius-panel-frame p-5 text-center">
          <div className="text-3xl text-aurelius-gold font-semibold">{feed.autonomy.acted7}</div>
          <div className="text-[11px] uppercase tracking-widest text-neutral-500 mt-1.5">handled alone · 7d</div>
        </div>
      </div>

      {/* Follow-through across weeks */}
      <section className="aurelius-panel-frame p-5">
        <div className="flex items-baseline justify-between mb-2">
          <h2 className="aurelius-heading text-lg">Follow-through</h2>
          <span className="text-[11px] text-neutral-500">of what you said you'd do, what % got done — weekly</span>
        </div>
        <SparkLine values={ft} width={520} height={56} min={0} max={100} suffix="%" />
      </section>

      {/* The last fourteen days */}
      <section className="aurelius-panel-frame p-5">
        <div className="flex items-baseline justify-between mb-2">
          <h2 className="aurelius-heading text-lg">The last fourteen days</h2>
          <span className="text-[11px] text-neutral-500">tasks done per day</span>
        </div>
        <SparkBars values={doneBars} labels={days.map((d) => d.label)} width={520} height={72} />
      </section>

      {/* Habit consistency */}
      {feed.habits.length > 0 && (
        <section className="aurelius-panel-frame p-5 space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="aurelius-heading text-lg">Habits</h2>
            <span className="text-[11px] text-neutral-500">14-day grid · streaks</span>
          </div>
          {feed.habits.map((h) => (
            <div key={h.id} className="flex items-center justify-between gap-3">
              <span className="text-sm text-neutral-200 flex-1 truncate">{h.name}</span>
              <DotRow days={days.map((d) => habitDays.get(h.id)?.has(d.key) ?? false)} />
              <span className="text-xs text-aurelius-gold/80 w-12 text-right">
                {h.streak > 0 ? `${h.streak}✦` : "—"}
              </span>
            </div>
          ))}
        </section>
      )}

      {/* Goal pace — progress vs the clock */}
      {feed.goals.length > 0 && (
        <section className="aurelius-panel-frame p-5 space-y-4">
          <div className="flex items-baseline justify-between">
            <h2 className="aurelius-heading text-lg">Goal pace</h2>
            <span className="text-[11px] text-neutral-500">progress vs time elapsed</span>
          </div>
          {feed.goals.map((g) => {
            const pct = g.progressPct ?? 0;
            let paceNote: { text: string; cls: string } | null = null;
            if (g.targetDate && g.createdAt) {
              const total = new Date(g.targetDate).getTime() - new Date(g.createdAt).getTime();
              const gone = Date.now() - new Date(g.createdAt).getTime();
              if (total > 0) {
                const timePct = Math.min(100, Math.round((gone / total) * 100));
                paceNote =
                  pct >= timePct
                    ? { text: `on pace (${pct}% done, ${timePct}% of time)`, cls: "text-emerald-400" }
                    : { text: `behind (${pct}% done, ${timePct}% of time)`, cls: "text-amber-300" };
              }
            }
            return (
              <div key={g.id}>
                <div className="flex items-baseline justify-between mb-1">
                  <span className="text-sm">{g.name}</span>
                  <span className="text-xs text-neutral-500">
                    {(g.measure?.current ?? 0)}/{(g.measure?.target ?? 1)} · <span className="text-aurelius-gold">{pct}%</span>
                  </span>
                </div>
                <div className="h-2 bg-black/60 rounded-full overflow-hidden border border-aurelius-gold/15">
                  <div className="h-full rounded-full aurelius-bar-fill transition-all duration-500" style={{ width: `${pct}%` }} />
                </div>
                {paceNote && <p className={`text-[11px] mt-1 ${paceNote.cls}`}>{paceNote.text}</p>}
              </div>
            );
          })}
        </section>
      )}

      {/* Aurelius's lane */}
      <section className="aurelius-panel-frame p-5 space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="aurelius-heading text-lg">Aurelius's week</h2>
          <span className="text-[11px] text-neutral-500">the trust loop, counted</span>
        </div>
        <p className="text-sm text-neutral-300">
          <span className="text-aurelius-gold font-semibold">{feed.autonomy.acted7}</span> handled alone ·{" "}
          <span className={feed.autonomy.undone7 > 0 ? "text-amber-300" : "text-neutral-400"}>
            {feed.autonomy.undone7} undone
          </span>{" "}
          · <span className="text-neutral-400">{feed.autonomy.pendingNow} awaiting you</span>
        </p>
        <div className="flex items-center gap-3">
          <span className="text-xs text-neutral-500 w-44">LLM dependence (lower = smarter)</span>
          <SparkLine values={llm} width={300} height={40} min={0} max={100} suffix="%" />
        </div>
        {/* The learning metrics — computed every Sunday, finally drawn
            (final council): patterns rising + corrections falling is the
            compounding-intelligence thesis, falsifiable at a glance. */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-neutral-500 w-44">Compiled patterns (rising = learning)</span>
          <SparkLine values={feed.weeks.map((w) => w.patternsActive)} width={300} height={40} min={0} />
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-neutral-500 w-44">Corrections (falling = it's sticking)</span>
          <SparkLine values={feed.weeks.map((w) => w.corrections)} width={300} height={40} min={0} />
        </div>
      </section>
    </div>
  );
}
