"use client";

// MISSIONS — what the system is doing in the background.
// Missions (the autonomy loop), activity counts, compiled patterns,
// research memory, the pulse. Plus the launcher: give it an objective,
// it plans, runs, and reports — the report joins the second brain.
//
// ELEVATED IMPERIAL re-dress: same fetches (/api/deck, /api/scoreboard,
// /api/missions), same launcher and Run handlers — new surfaces only.

import { useCallback, useEffect, useState } from "react";
import { Btn, Panel, SectionLabel, Stat } from "../kit";

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

// Imperial status inks — gold is work, patina is done, terracotta failed.
const STATUS_COLOR: Record<string, string> = {
  proposed: "var(--ink3)",
  planned: "var(--ink2)",
  running: "var(--gold)",
  completed: "var(--money)",
  failed: "var(--danger)",
  cancelled: "var(--ink3)",
  archived: "var(--ink3)", // unanswered 14 days → the sweep retired it
};

const STEP_GLYPH: Record<string, string> = { recall: "❈", research: "☄", synthesize: "✒" };

export default function MissionsPanel() {
  const [activity, setActivity] = useState<Activity | null>(null);
  const [objective, setObjective] = useState("");
  const [launching, setLaunching] = useState(false);
  const [week, setWeek] = useState<{ acted7: number; undone7: number; pendingNow: number } | null>(null);
  // null = still checking; the pulse dot must not glow for a dead backend.
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
    <div className="max-w-3xl mx-auto space-y-8 aurelius-reveal">
      <div className="flex items-baseline justify-between gap-4 flex-wrap">
        <SectionLabel row>Missions — the background work</SectionLabel>
        <span className="au-kicker flex items-center gap-2" style={{ fontSize: 13.5 }}>
          {alive === false ? (
            <>
              <span className="w-2 h-2 rounded-full" style={{ background: "var(--danger)", boxShadow: "0 0 8px rgba(201,107,90,.5)" }} />
              brain unreachable
            </>
          ) : (
            <>
              <span
                className={`w-2 h-2 rounded-full ${alive ? "au-breathe" : ""}`}
                style={alive ? { background: "var(--gold)", boxShadow: "0 0 8px rgba(212,175,55,.5)" } : { background: "var(--ink3)" }}
              />
              {alive ? "pulse armed" : "checking…"}
            </>
          )}
        </span>
      </div>

      {/* The week, counted — the trust loop made visible */}
      {week && (
        <p className="au-kicker -mt-4" style={{ display: "block" }}>
          this week on its own:{" "}
          <b style={{ color: "var(--gold)", fontStyle: "normal" }}>{week.acted7}</b> handled ·{" "}
          <b style={{ color: week.undone7 > 0 ? "var(--attn)" : "var(--ink3)", fontStyle: "normal" }}>{week.undone7} undone</b> ·{" "}
          {week.pendingNow} awaiting you
        </p>
      )}

      {/* MISSION LAUNCHER — the autonomy front door */}
      <div className="space-y-3">
        <div className="au-chatbar">
          <input
            value={objective}
            onChange={(e) => setObjective(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && launch()}
            placeholder="Give Aurelius an objective — it plans, runs it in the background, and reports…"
            aria-label="Mission objective"
          />
          <Btn onClick={launch} disabled={launching} className="shrink-0">
            {launching ? "Launching…" : "Launch"}
          </Btn>
        </div>
        {launchError && <p className="text-xs" style={{ color: "var(--attn)" }}>{launchError}</p>}

        {missions.length === 0 ? (
          <p className="au-kicker text-center py-4" style={{ display: "block" }}>
            No missions yet. Objectives become plans, plans become reports, reports join the second brain.
          </p>
        ) : (
          <div className="space-y-2.5">
            {missions.map((m) => (
              <div
                key={m.id}
                className="au-card px-4 py-3"
                style={m.status === "running" ? { borderColor: "var(--gold-line)" } : undefined}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm flex-1" style={{ color: "var(--ink)" }}>
                    {m.title}
                    {m.origin === "aurelius_proposed" && (
                      <span
                        className="ml-2 text-[10px] uppercase tracking-wider rounded-[2px] px-1.5 py-0.5"
                        style={{ color: "var(--gold-dim)", border: "1px solid var(--gold-line)" }}
                      >
                        aurelius proposed
                      </span>
                    )}
                  </span>
                  {m.status === "proposed" ? (
                    <Btn
                      ghost
                      style={{ padding: ".2rem .7rem", fontSize: 11 }}
                      onClick={async () => {
                        await fetch("/api/missions", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ run: m.id }),
                        });
                        await load();
                      }}
                    >
                      Run ▸
                    </Btn>
                  ) : (
                    <span
                      className="text-xs uppercase"
                      style={{
                        fontFamily: "var(--font-body),Georgia,serif", fontWeight: 600, letterSpacing: ".14em",
                        color: STATUS_COLOR[m.status] ?? "var(--ink3)",
                      }}
                    >
                      {m.status}
                    </span>
                  )}
                </div>
                {m.planSummary && <p className="text-xs mt-1" style={{ color: "var(--ink3)" }}>{m.planSummary}</p>}
                {m.status === "completed" && m.corpusDocId && (
                  <a
                    href={`/brain?doc=${m.corpusDocId}`}
                    className="inline-block text-xs hover:underline underline-offset-2 mt-1.5"
                    style={{ color: "var(--gold)" }}
                  >
                    Read the report →
                  </a>
                )}
                {m.steps.length > 0 && (
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {m.steps.map((s) => (
                      <span
                        key={s.idx}
                        title={`${s.kind}: ${s.status}${s.error ? ` — ${s.error}` : ""}`}
                        className={`text-xs px-2 py-0.5 rounded-full border ${s.status === "running" ? "animate-pulse" : ""}`}
                        style={{
                          color:
                            s.status === "done" ? "var(--money)"
                            : s.status === "running" ? "var(--gold)"
                            : s.status === "failed" ? "var(--danger)"
                            : "var(--ink3)",
                          borderColor:
                            s.status === "done" ? "rgba(168,195,154,.4)"
                            : s.status === "running" ? "var(--gold-line)"
                            : s.status === "failed" ? "rgba(201,107,90,.4)"
                            : "var(--line2)",
                        }}
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
      </div>

      {/* The day's internal motion */}
      <div className="au-lit grid grid-cols-2 gap-6 max-w-md mx-auto">
        <Stat label="memories · 24h" value={activity?.counts.memories24h ?? "—"} pct={activity?.counts.memories24h ? 70 : 0} />
        <Stat label="reasoning runs · 24h" value={activity?.counts.reasoningRuns24h ?? "—"} pct={activity?.counts.reasoningRuns24h ? 70 : 0} />
      </div>

      <Panel tier="card" label="Compiled patterns" className="p-6">
        {(activity?.recentPatterns ?? []).length === 0 ? (
          <p className="au-kicker" style={{ display: "block" }}>
            Nothing compiled yet — patterns emerge as situations repeat. This is how Aurelius learns to lean on the LLM less.
          </p>
        ) : (
          <ul className="space-y-2 text-sm">
            {activity!.recentPatterns.map((p, i) => (
              <li key={i} style={{ color: "var(--ink2)" }}>
                <span style={{ color: "var(--gold)" }}>{p.patternType}</span> · {p.domain} · seen {p.supportCount}×
                <span className="text-xs ml-2" style={{ color: "var(--ink3)" }}>({p.status.replace(/_/g, " ")})</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel tier="card" label="Research memory" className="p-6">
        {(activity?.recentResearch ?? []).length === 0 ? (
          <p className="au-kicker" style={{ display: "block" }}>
            The weekend pass runs Sundays 09:00 — findings and knowledge proposals land here for Monday review.
          </p>
        ) : (
          <ul className="space-y-2.5 text-sm" style={{ color: "var(--ink2)" }}>
            {activity!.recentResearch.map((r, i) => <li key={i}>• {r.summary}</li>)}
          </ul>
        )}
      </Panel>

      {/* The old hardcoded 3-item "Pulse" card was a static under-truth about
          a ~16-job spine (alignment council) — the honest instrument is the
          spine-health grid, one tab over. Point there; state truth nowhere twice. */}
      <Panel tier="card" label="The pulse" className="p-6">
        <p className="text-sm" style={{ color: "var(--ink2)" }}>
          The scheduled spine — briefings, sweeps, the Sunday learning cycle — runs inside the backend around the clock.{" "}
          <a href="/aurelius?tab=traces" className="hover:underline underline-offset-2" style={{ color: "var(--gold)" }}>
            Watch every job fire, day by day →
          </a>
        </p>
      </Panel>
    </div>
  );
}
