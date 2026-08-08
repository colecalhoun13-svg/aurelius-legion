"use client";

// ATHLETES — every athlete's standard, engraved (REDESIGN_PLAN.md, new tab).
//
// The roster comes from /api/athletes (clients + metric/PR counts); selecting
// an athlete loads the EXISTING retention view (/api/crm/retention?clientId=)
// and renders the radar + the ledger of bests. Logging a metric POSTs the
// existing retention kind:"metric" — the same write the rest of the system
// uses, PR detection included.
//
// Honesty rules this page: with zero clients it shows the blank instrument
// and says the roster is empty — never sample athletes, never rendered
// zeroes dressed as progress. And because no per-sport standards exist on
// clients yet, each axis is normalized against THAT athlete's own history
// (latest vs his min/max) — his shape over time, and the page says so.
// (A "You" chip for Cole's own training is a later phase — not faked here.)

import { useCallback, useEffect, useMemo, useState } from "react";
import { Panel, Btn, Divider, LedgerRow, day } from "../../../components/kit";
import AthleteRadar, { type RadarAxis } from "../../../components/kit/AthleteRadar";

type Athlete = { id: string; name: string; sport: string | null; prCount: number; metricCount: number };

type Metric = {
  id: string;
  label: string;
  value: number;
  unit: string | null;
  isPR: boolean;
  achievedAt: string;
};

type RetentionView = {
  name: string;
  isMinor: boolean;
  metrics: Metric[];
  prCount: number;
};

// Mirrors aurelius/crm/retention.ts — times/sprints improve DOWNWARD;
// strength/jumps improve UPWARD. A slower 40 must never plot further out.
const LOWER_IS_BETTER = /dash|sprint|\btime\b|\b40\b|10-?yard|5-?10-?5|agility|mile|:/i;

const fmtValue = (m: Metric) => {
  const v = Number.isInteger(m.value) ? String(m.value) : String(Math.round(m.value * 100) / 100);
  return `${v}${m.unit ?? ""}`;
};

const MAX_AXES = 8;

/** Group metrics by label (latest first, as the API orders them) and map each
 *  label to a radar axis: latest value positioned against that athlete's own
 *  min/max history, banded 60..130. One data point sits mid-band at 95 —
 *  a baseline, not a judgment. */
function deriveAxes(metrics: Metric[]): { axes: RadarAxis[]; priorR?: number[] } {
  const groups = new Map<string, Metric[]>();
  for (const m of metrics) {
    const key = m.label.trim().toLowerCase();
    const g = groups.get(key);
    if (g) g.push(m);
    else groups.set(key, [m]);
  }
  const position = (g: Metric[], m: Metric): number => {
    const values = g.map((x) => x.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    if (max === min) return 95;
    const lower = LOWER_IS_BETTER.test(g[0].label);
    const frac = lower ? (max - m.value) / (max - min) : (m.value - min) / (max - min);
    return 60 + 70 * frac;
  };
  // Most recently active labels first, then a fixed alphabetical axis order.
  const picked = [...groups.values()]
    .sort((a, b) => new Date(b[0].achievedAt).getTime() - new Date(a[0].achievedAt).getTime())
    .slice(0, MAX_AXES)
    .sort((a, b) => a[0].label.localeCompare(b[0].label));
  const axes: RadarAxis[] = picked.map((g) => ({
    label: g[0].label,
    display: fmtValue(g[0]),
    r: position(g, g[0]),
    pr: g[0].isPR,
  }));
  const anyPrior = picked.some((g) => g.length > 1);
  const priorR = anyPrior ? picked.map((g) => (g.length > 1 ? position(g, g[1]) : position(g, g[0]))) : undefined;
  return { axes, priorR };
}

const field =
  "bg-black/50 border border-aurelius-gold/30 rounded-[2px] px-2 py-1.5 text-sm text-aurelius-text placeholder:text-aurelius-text/30";

export default function AthletesPage() {
  const [athletes, setAthletes] = useState<Athlete[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<RetentionView | null>(null);
  const [viewError, setViewError] = useState<string | null>(null);

  const loadRoster = useCallback(async (): Promise<Athlete[]> => {
    const res = await fetch("/api/athletes");
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error ?? "Failed to load athletes");
    setAthletes(data.athletes);
    return data.athletes as Athlete[];
  }, []);

  const loadView = useCallback(async (clientId: string) => {
    setViewError(null);
    try {
      const res = await fetch(`/api/crm/retention?clientId=${encodeURIComponent(clientId)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Failed to load the athlete");
      setView(data);
    } catch (e: any) {
      setView(null);
      setViewError(e?.message ?? "Failed to load the athlete");
    }
  }, []);

  useEffect(() => {
    let gone = false;
    loadRoster()
      .then((roster) => {
        if (!gone && roster.length > 0) setSelectedId((cur) => cur ?? roster[0].id);
      })
      .catch(() => {
        if (!gone) setLoadFailed(true);
      });
    return () => {
      gone = true;
    };
  }, [loadRoster]);

  useEffect(() => {
    if (selectedId) loadView(selectedId);
  }, [selectedId, loadView]);

  const selected = athletes?.find((a) => a.id === selectedId) ?? null;
  const { axes, priorR } = useMemo(() => deriveAxes(view?.metrics ?? []), [view]);

  // Latest entry per label — the ledger of bests, newest first.
  const latestByLabel = useMemo(() => {
    const seen = new Set<string>();
    const out: Metric[] = [];
    for (const m of view?.metrics ?? []) {
      const key = m.label.trim().toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(m);
    }
    return out;
  }, [view]);

  const centerWord =
    view && view.prCount > 0
      ? `${view.prCount} PR${view.prCount === 1 ? "" : "S"}`
      : selected?.sport ?? undefined;

  if (loadFailed) {
    return (
      <div className="au-horizon">
        <div className="p-6 max-w-6xl mx-auto">
          <h1 className="au-title" style={{ fontSize: "clamp(2rem,5vw,2.6rem)", lineHeight: 1.1 }}>Athletes</h1>
          <div className="rounded-[2px] border border-red-500/40 bg-red-950/20 p-4 text-sm text-red-200 mt-4">
            Couldn&apos;t load the roster. This is a loading failure, not an empty roster — your data is fine.
            <button
              onClick={() => { setLoadFailed(false); loadRoster().catch(() => setLoadFailed(true)); }}
              className="ml-3 underline hover:text-red-100"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="au-horizon">
      <div className="p-6 max-w-6xl mx-auto pb-24 relative">
        <div className="aurelius-reveal space-y-8">
          <header className="text-center">
            <h1 className="au-title" style={{ fontSize: "clamp(2rem,5vw,2.6rem)", lineHeight: 1.1, margin: 0 }}>
              Athletes
            </h1>
            <p className="au-kicker" style={{ display: "block", marginTop: ".5rem", fontSize: "1.05rem", color: "var(--ink2)" }}>
              Every athlete against the standard — the bests, engraved.
            </p>
            <p className="au-kicker" style={{ display: "block", marginTop: ".7rem", fontSize: 13.5, maxWidth: "44rem", marginLeft: "auto", marginRight: "auto" }}>
              Each axis is his shape over his own history — until your per-sport standards land.
            </p>
          </header>

          {athletes == null ? (
            <p className="au-kicker" style={{ display: "block", textAlign: "center" }}>reading the roster…</p>
          ) : athletes.length === 0 ? (
            /* ── the honest empty: no clients, no theatre ── */
            <div className="text-center">
              <div className="flex justify-center mt-2">
                <AthleteRadar axes={[]} />
              </div>
              <p className="au-kicker" style={{ display: "block", marginTop: "1rem" }}>
                awaiting the first athlete — they arrive through the pipeline
              </p>
            </div>
          ) : (
            <>
              {/* ── the roster strip ── */}
              <div className="flex gap-2 justify-center flex-wrap">
                {athletes.map((a) => (
                  <Btn
                    key={a.id}
                    ghost
                    onClick={() => setSelectedId(a.id)}
                    style={a.id === selectedId ? { color: "var(--gold)", borderColor: "var(--gold-line)" } : undefined}
                    aria-pressed={a.id === selectedId}
                  >
                    {a.name} · {a.prCount} PR{a.prCount === 1 ? "" : "s"}
                  </Btn>
                ))}
              </div>

              {viewError ? (
                <div className="rounded-[2px] border border-red-500/40 bg-red-950/20 p-4 text-sm text-red-200 max-w-xl mx-auto">
                  {viewError}
                  {selectedId && (
                    <button onClick={() => loadView(selectedId)} className="ml-3 underline hover:text-red-100">Retry</button>
                  )}
                </div>
              ) : view == null ? (
                <p className="au-kicker" style={{ display: "block", textAlign: "center" }}>reading the ledger…</p>
              ) : (
                <>
                  {/* ── the instrument ── */}
                  <section className="text-center">
                    <h2 className="au-title" style={{ fontSize: "clamp(1.4rem,3.5vw,1.9rem)", lineHeight: 1.1, margin: 0 }}>
                      {view.name}
                    </h2>
                    {selected?.sport && (
                      <p className="au-kicker" style={{ display: "block", marginTop: ".35rem" }}>{selected.sport}</p>
                    )}
                    <div className="flex justify-center mt-4">
                      <AthleteRadar key={selectedId} axes={axes} priorR={priorR} centerWord={centerWord} />
                    </div>
                    <p className="au-kicker" style={{ display: "block", marginTop: ".6rem", fontSize: 13.5 }}>
                      {axes.length >= 3
                        ? priorR
                          ? "the dashed ghost is the prior entry per lift — the gold line is now, against his own range"
                          : "positioned against his own history — more entries per lift will draw the ghost"
                        : axes.length === 2
                          ? "two measures — a pair of gauges, not a shape; a third draws the polygon"
                          : "no numbers on record yet — the first entry below starts the shape"}
                    </p>
                  </section>

                  <Divider />

                  {/* ── the ledger of bests ── */}
                  <Panel label="The ledger of bests" className="max-w-2xl mx-auto">
                    {latestByLabel.length === 0 ? (
                      <p className="au-kicker" style={{ display: "block", textAlign: "center" }}>
                        nothing measured yet — log the first number below
                      </p>
                    ) : (
                      latestByLabel.map((m) => (
                        <LedgerRow
                          key={m.id}
                          tick={m.isPR ? "gold" : "hollow"}
                          verb={m.label}
                          obj={
                            <>
                              {fmtValue(m)}
                              {m.isPR ? " · personal best" : ""} · {day(m.achievedAt)}
                            </>
                          }
                        />
                      ))
                    )}
                  </Panel>

                  <Divider />

                  {/* ── log a metric — the one real write on this page ── */}
                  <LogMetricForm
                    clientId={selectedId!}
                    onLogged={async () => {
                      await Promise.all([loadView(selectedId!), loadRoster().catch(() => {})]);
                    }}
                  />
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function LogMetricForm({ clientId, onLogged }: { clientId: string; onLogged: () => Promise<void> }) {
  const [label, setLabel] = useState("");
  const [value, setValue] = useState("");
  const [unit, setUnit] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  const submit = async () => {
    const v = Number(value);
    if (!label.trim() || !Number.isFinite(v)) {
      setNote({ ok: false, text: "A metric needs a label and a number." });
      return;
    }
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch("/api/crm/retention", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, kind: "metric", label: label.trim(), value: v, unit: unit.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Could not log the metric");
      setNote({ ok: true, text: data.isPR ? "logged — a personal best" : "logged" });
      setLabel("");
      setValue("");
      setUnit("");
      await onLogged();
    } catch (e: any) {
      setNote({ ok: false, text: e?.message ?? "Could not log the metric" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel label="Log a metric" className="max-w-2xl mx-auto">
      <div className="flex gap-2 flex-wrap items-center justify-center">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Vertical, squat, 40…"
          className={`${field} flex-1 min-w-[10rem]`}
        />
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Value"
          inputMode="decimal"
          className={`${field} w-24`}
        />
        <input
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
          placeholder="in / lbs / s"
          className={`${field} w-24`}
        />
        <Btn onClick={submit} disabled={busy}>
          {busy ? "Logging…" : "Log it"}
        </Btn>
      </div>
      {note && (
        <p
          className="au-kicker"
          style={{ display: "block", textAlign: "center", marginTop: ".7rem", color: note.ok ? "var(--gold)" : "var(--danger)" }}
        >
          {note.text}
        </p>
      )}
      <p className="au-kicker" style={{ display: "block", textAlign: "center", marginTop: ".5rem", fontSize: 13 }}>
        times and sprints count down, lifts and jumps count up — a PR is detected, never declared
      </p>
    </Panel>
  );
}
