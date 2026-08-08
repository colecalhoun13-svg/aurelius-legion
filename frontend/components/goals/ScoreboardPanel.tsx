"use client";

// THE SCOREBOARD — the coach's wall. "Did the number go up," answered in
// one glance: follow-through across weeks, the last fourteen days as bars,
// habit consistency as dot-grids, each goal's pace against its clock, and
// Aurelius's own week (work handled alone, and how much thinking is
// compiled vs rented). Charts start sparse and fill in as weeks accrue —
// short lines are honest lines.
//
// ELEVATED IMPERIAL re-dress: same fetch, same metrics — every one of them
// (follow-through, earned, llmDependence, patterns, corrections, autonomy,
// habits, goal pace) survives; only the dress changed to kit surfaces.

import { useEffect, useState } from "react";
import { SparkLine, SparkBars, DotRow } from "../viz/Spark";
import { Divider, Panel, Stat, Tick } from "../kit";

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
  earnedThisWeekCents: number;
  earnedAllTimeCents: number;
  leadsThisWeek: number;
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

/** The last `n` local days, oldest first. Calendar-stepped, not 86400s
 *  arithmetic — DST fall-back would duplicate a key. */
function lastDays(n: number): { key: string; label: string }[] {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (n - 1 - i));
    return { key: dayKey(d), label: "SMTWTFS"[d.getDay()]! };
  });
}

const kickerSm: React.CSSProperties = { fontSize: 12.5 };
const rowLabel: React.CSSProperties = {
  fontFamily: "var(--font-body),Georgia,serif", fontWeight: 600, fontSize: 12,
  letterSpacing: ".14em", textTransform: "uppercase", color: "var(--ink3)",
};

export default function ScoreboardPanel() {
  const [feed, setFeed] = useState<Feed | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/scoreboard")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("unreachable"))))
      .then(setFeed)
      .catch(() => setErr("Aurelius couldn't load the scoreboard — try again in a moment."));
  }, []);

  if (err) return <p className="au-kicker max-w-3xl mx-auto relative" style={{ display: "block", color: "var(--attn)" }}>{err}</p>;
  if (!feed) return <p className="au-kicker max-w-3xl mx-auto relative" style={{ display: "block" }}>…</p>;

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
    <div className="max-w-3xl mx-auto space-y-8 relative" style={{ color: "var(--ink)" }}>
      <p className="au-kicker text-center" style={{ display: "block" }}>did the number go up</p>

      {/* Hero — this stretch, in three numbers */}
      <div className="au-lit grid grid-cols-3 gap-6">
        <Stat value={doneTotal14} pct={100} label="done · 14 days" />
        <Stat
          value={latest?.followThrough != null ? latest.followThrough : "—"}
          unit={latest?.followThrough != null ? "%" : undefined}
          pct={latest?.followThrough ?? 0}
          label="follow-through"
        />
        <Stat value={feed.autonomy.acted7} pct={100} label="handled alone · 7d" />
      </div>

      {/* Money — earned is real (arrived); leads is motion. Shown only once
          there's something to show, and never conflated: a busy pipeline is
          not a paid one. Rendered when any money has ever arrived OR a lead
          moved this week. */}
      {(latest && (latest.earnedAllTimeCents > 0 || latest.leadsThisWeek > 0)) && (
        <>
          <Divider />
          <Panel label="Money"
            headerRight={<span className="au-kicker" style={kickerSm}>earned is what arrived · leads is motion, not money</span>}>
            <div className="au-lit grid grid-cols-3 gap-6">
              <Stat tone="money" countUpCents={latest.earnedThisWeekCents} pct={100} label="earned · this week" />
              <Stat tone="money" countUpCents={latest.earnedAllTimeCents} pct={100} label="earned · all-time" />
              <Stat value={latest.leadsThisWeek} pct={100} label="leads · this week" />
            </div>
          </Panel>
        </>
      )}

      <Divider />

      {/* Follow-through across weeks */}
      <Panel label="Follow-through"
        headerRight={<span className="au-kicker" style={kickerSm}>of what you said you&apos;d do, what % got done — weekly</span>}>
        <SparkLine values={ft} width={520} height={56} min={0} max={100} suffix="%" />
      </Panel>

      {/* The last fourteen days */}
      <Panel label="The last fourteen days"
        headerRight={<span className="au-kicker" style={kickerSm}>tasks done per day</span>}>
        <SparkBars values={doneBars} labels={days.map((d) => d.label)} width={520} height={72} />
      </Panel>

      {/* Habit consistency */}
      {feed.habits.length > 0 && (
        <>
          <Divider />
          <Panel label="The habits"
            headerRight={<span className="au-kicker" style={kickerSm}>14-day grid · streaks</span>}>
            <div className="space-y-3">
              {feed.habits.map((h) => (
                <div key={h.id} className="flex items-center justify-between gap-3">
                  <Tick em />
                  <span className="text-sm flex-1 truncate" style={{ color: "var(--ink)" }}>{h.name}</span>
                  <DotRow days={days.map((d) => habitDays.get(h.id)?.has(d.key) ?? false)} />
                  <span className="w-12 text-right au-kicker" style={{ color: h.streak > 0 ? "var(--gold)" : "var(--ink3)", fontSize: 14 }}>
                    {h.streak > 0 ? `${h.streak}d` : "—"}
                  </span>
                </div>
              ))}
            </div>
          </Panel>
        </>
      )}

      {/* Goal pace — progress vs the clock */}
      {feed.goals.length > 0 && (
        <Panel label="Goal pace"
          headerRight={<span className="au-kicker" style={kickerSm}>progress vs time elapsed</span>}>
          <div className="space-y-4">
            {feed.goals.map((g) => {
              const pct = g.progressPct ?? 0;
              let paceNote: { text: string; color: string } | null = null;
              if (g.targetDate && g.createdAt) {
                const total = new Date(g.targetDate).getTime() - new Date(g.createdAt).getTime();
                const gone = Date.now() - new Date(g.createdAt).getTime();
                if (total > 0) {
                  const timePct = Math.min(100, Math.round((gone / total) * 100));
                  paceNote =
                    pct >= timePct
                      ? { text: `on pace (${pct}% done, ${timePct}% of time)`, color: "var(--money)" }
                      : { text: `behind (${pct}% done, ${timePct}% of time)`, color: "var(--attn)" };
                }
              }
              return (
                <div key={g.id}>
                  <div className="flex items-baseline justify-between mb-1 gap-3">
                    <span className="text-sm" style={{ color: "var(--ink)" }}>{g.name}</span>
                    <span style={{
                      fontFamily: "var(--font-data),Arial,sans-serif", fontSize: 12,
                      color: "var(--ink3)", fontVariantNumeric: "tabular-nums",
                    }}>
                      {(g.measure?.current ?? 0)}/{(g.measure?.target ?? 1)} ·{" "}
                      <span style={{ color: "var(--gold)" }}>{pct}%</span>
                    </span>
                  </div>
                  <div style={{ height: 5, background: "var(--line1)", borderRadius: 1, overflow: "hidden" }}>
                    <div style={{
                      height: "100%", width: `${pct}%`,
                      background: "linear-gradient(90deg,var(--gold-dim),var(--gold-bright))",
                      transition: "width .5s var(--au-ease)",
                    }} />
                  </div>
                  {paceNote && (
                    <p className="au-kicker" style={{ display: "block", marginTop: 4, fontSize: 12.5, color: paceNote.color }}>
                      {paceNote.text}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </Panel>
      )}

      <Divider />

      {/* Aurelius's lane */}
      <Panel label="Aurelius's week"
        headerRight={<span className="au-kicker" style={kickerSm}>the trust loop, counted</span>}>
        <div className="space-y-3">
          <p className="text-sm" style={{ color: "var(--ink2)" }}>
            <span style={{ color: "var(--gold)", fontWeight: 600 }}>{feed.autonomy.acted7}</span> handled alone ·{" "}
            <span style={{ color: feed.autonomy.undone7 > 0 ? "var(--attn)" : "var(--ink3)" }}>
              {feed.autonomy.undone7} undone
            </span>{" "}
            · <span style={{ color: "var(--ink3)" }}>{feed.autonomy.pendingNow} awaiting you</span>
          </p>
          <div className="flex items-center gap-3">
            <span className="w-44 shrink-0" style={rowLabel}>LLM dependence <span className="au-kicker" style={{ textTransform: "none", letterSpacing: 0 }}>(lower = smarter)</span></span>
            <SparkLine values={llm} width={300} height={40} min={0} max={100} suffix="%" />
          </div>
          {/* The learning metrics — computed every Sunday, finally drawn
              (final council): patterns rising + corrections falling is the
              compounding-intelligence thesis, falsifiable at a glance. */}
          <div className="flex items-center gap-3">
            <span className="w-44 shrink-0" style={rowLabel}>Compiled patterns <span className="au-kicker" style={{ textTransform: "none", letterSpacing: 0 }}>(rising = learning)</span></span>
            <SparkLine values={feed.weeks.map((w) => w.patternsActive)} width={300} height={40} min={0} />
          </div>
          <div className="flex items-center gap-3">
            <span className="w-44 shrink-0" style={rowLabel}>Corrections <span className="au-kicker" style={{ textTransform: "none", letterSpacing: 0 }}>(falling = it&apos;s sticking)</span></span>
            <SparkLine values={feed.weeks.map((w) => w.corrections)} width={300} height={40} min={0} />
          </div>
        </div>
      </Panel>
    </div>
  );
}
