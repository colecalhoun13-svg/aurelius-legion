"use client";

// ATHLETE ZERO — Cole's own tab. His readiness (WHOOP), his numbers, and where
// they're heading — kept separate from the athletes he coaches. Same fetch →
// kit render pattern as the rest of the app; empty-honest (a section with no
// data says how to fill it, never fakes a number). Re-dress, never invent.

import { useCallback, useEffect, useState } from "react";
import { Btn, Divider, Panel, SectionLabel, Stat } from "../../../components/kit";

type Readiness = { recovery: number | null; hrv: number | null; restingHr: number | null; at: string | null };
type Series = {
  label: string; unit: string | null; count: number;
  latest: { value: number }; best: { value: number }; improvementPct: number | null;
  stalled: boolean; regressing: boolean;
};
type Curve = { measure: string; unit: string | null; ratePerWeek: number | null; projected90d: number | null; trajectory: string };
type Target = {
  id: string; label: string; unit: string | null; targetValue: number; targetDate: string | null;
  pace: "achieved" | "on_track" | "behind" | "past_due" | "open" | "no_data";
  latestValue: number | null; remaining: number | null; achievedAt: string | null;
};
type Experiment = {
  id: string; hypothesis: string; metricLabel: string; protocol: string | null; status: string;
  baselineValue: number | null; resultValue: number | null; verdict: string | null; startAt: string;
};
type ZeroData = {
  athlete: string;
  readiness: Readiness | null;
  whoop: { configured: boolean; reason: string | null };
  sheetUrl: string | null;
  series: Series[];
  targets: Target[];
  curves: Curve[];
  experiments: Experiment[];
  error?: string;
};

const PACE_TONE: Record<string, string> = {
  achieved: "var(--money)",
  on_track: "var(--money)",
  behind: "var(--attn)",
  past_due: "var(--danger)",
  open: "var(--ink3)",
  no_data: "var(--ink3)",
};
const PACE_LABEL: Record<string, string> = {
  achieved: "hit", on_track: "on track", behind: "behind", past_due: "past due", open: "open", no_data: "no data yet",
};

const TRAJ_TONE: Record<string, string> = {
  accelerating: "var(--money)",
  steady: "var(--money)",
  plateauing: "var(--attn)",
  declining: "var(--danger)",
  insufficient: "var(--ink3)",
};

export default function ZeroPage() {
  const [data, setData] = useState<ZeroData | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [label, setLabel] = useState("");
  const [value, setValue] = useState("");
  const [unit, setUnit] = useState("");
  const [tLabel, setTLabel] = useState("");
  const [tValue, setTValue] = useState("");
  const [tUnit, setTUnit] = useState("");
  const [tDate, setTDate] = useState("");
  const [tBusy, setTBusy] = useState(false);
  const [sheet, setSheet] = useState("");
  const [sheetBusy, setSheetBusy] = useState(false);
  const [hypothesis, setHypothesis] = useState("");
  const [expMetric, setExpMetric] = useState("");
  const [expEnd, setExpEnd] = useState("");
  const [expBusy, setExpBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/zero");
      if (!res.ok) return setFailed(true);
      setData(await res.json());
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function logNumber() {
    if (!label.trim() || !value) return;
    setBusy(true);
    try {
      await fetch("/api/zero", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ op: "log", label: label.trim(), value: Number(value), unit: unit.trim() || undefined }) });
      setLabel(""); setValue(""); setUnit("");
      await load();
    } finally { setBusy(false); }
  }

  async function setTargetGoal() {
    if (!tLabel.trim() || !tValue) return;
    setTBusy(true);
    try {
      await fetch("/api/zero", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ op: "target", label: tLabel.trim(), targetValue: Number(tValue), unit: tUnit.trim() || undefined, targetDate: tDate.trim() || undefined }) });
      setTLabel(""); setTValue(""); setTUnit(""); setTDate("");
      await load();
    } finally { setTBusy(false); }
  }

  async function abandonExperiment(id: string) {
    setExpBusy(true);
    try {
      await fetch("/api/zero", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ op: "exp_abandon", id }) });
      await load();
    } finally { setExpBusy(false); }
  }

  async function saveSheet() {
    setSheetBusy(true);
    try {
      await fetch("/api/zero", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ op: "sheet", url: sheet.trim() }) });
      setSheet("");
      await load();
    } finally { setSheetBusy(false); }
  }

  async function startExperiment() {
    if (!hypothesis.trim() || !expMetric.trim()) return;
    setExpBusy(true);
    try {
      await fetch("/api/zero", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ op: "exp_start", hypothesis: hypothesis.trim(), metricLabel: expMetric.trim(), endAt: expEnd.trim() || undefined }) });
      setHypothesis(""); setExpMetric(""); setExpEnd("");
      await load();
    } finally { setExpBusy(false); }
  }

  async function concludeExperiment(id: string) {
    setExpBusy(true);
    try {
      await fetch("/api/zero", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ op: "exp_conclude", id }) });
      await load();
    } finally { setExpBusy(false); }
  }

  if (failed) {
    return <div className="au-card" style={{ margin: "2rem auto", maxWidth: 560, textAlign: "center", color: "var(--ink2)" }}>
      Couldn&apos;t load Athlete Zero right now. It&apos;ll be here when the connection&apos;s back.
    </div>;
  }
  if (!data) return <div style={{ padding: "2rem", color: "var(--ink3)" }}>Loading…</div>;

  const r = data.readiness;
  const hasReadiness = !!r && r.recovery !== null;

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "1.5rem 1rem 4rem" }}>
      <h1 className="au-title" style={{ fontSize: 30, marginBottom: ".4rem" }}>Athlete Zero</h1>
      <p style={{ color: "var(--ink3)", marginBottom: "1.6rem" }}>
        Your own readiness, numbers, and trajectory — the standard, applied to you.
      </p>

      {/* READINESS — WHOOP */}
      <SectionLabel>Readiness</SectionLabel>
      <div style={{ height: ".9rem" }} />
      {hasReadiness ? (
        <section className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-8">
          <Stat label="Recovery" value={`${r!.recovery}`} unit="%" tone={r!.recovery! < 34 ? "alert" : "money"} />
          {r!.hrv !== null && <Stat label="HRV" value={`${r!.hrv}`} unit="ms" />}
          {r!.restingHr !== null && <Stat label="Resting HR" value={`${r!.restingHr}`} unit="bpm" />}
        </section>
      ) : (
        <Panel tier="glass">
          <p style={{ color: "var(--ink2)", margin: 0 }}>
            {data.whoop.configured
              ? "WHOOP is connected — your first recovery reading will land here on the next sync."
              : (data.whoop.reason ?? "WHOOP isn't connected yet.")}
          </p>
        </Panel>
      )}

      <Divider />

      {/* NUMBERS — performance series */}
      <SectionLabel>Your numbers</SectionLabel>
      <div style={{ height: ".9rem" }} />
      {data.series.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: ".5rem" }}>
          {data.series.map((s) => (
            <div key={s.label} className="au-lrow" style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "1rem" }}>
              <span style={{ color: "var(--ink)", textTransform: "capitalize" }}>{s.label}</span>
              <span style={{ fontVariantNumeric: "tabular-nums", color: "var(--ink2)" }}>
                <b style={{ color: "var(--ink)" }}>{s.latest.value}{s.unit ?? ""}</b>
                {s.improvementPct !== null && (
                  <span style={{ color: s.improvementPct >= 0 ? "var(--money)" : "var(--danger)", marginLeft: ".6em" }}>
                    {s.improvementPct >= 0 ? "+" : ""}{s.improvementPct}%
                  </span>
                )}
                {s.regressing && <span style={{ color: "var(--danger)", marginLeft: ".6em" }}>· sliding</span>}
                {s.stalled && !s.regressing && <span style={{ color: "var(--attn)", marginLeft: ".6em" }}>· stalled</span>}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <Panel tier="glass">
          <p style={{ color: "var(--ink2)", margin: 0 }}>
            No numbers logged for you yet. Log one below (or in chat: &ldquo;log my vertical 30in&rdquo;) and your trend starts here.
          </p>
        </Panel>
      )}

      {/* LOG A NUMBER — Zero is a place you PUT your training in, not just read it */}
      <div style={{ marginTop: ".9rem" }}>
        <Panel tier="glass">
          <div style={{ display: "flex", flexWrap: "wrap", gap: ".5rem", alignItems: "center" }}>
            <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="lift / test (e.g. vertical)" style={inputStyle} />
            <input value={value} onChange={(e) => setValue(e.target.value)} placeholder="value" inputMode="decimal" style={{ ...inputStyle, width: 90 }} />
            <input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="unit" style={{ ...inputStyle, width: 80 }} />
            <Btn disabled={busy || !label.trim() || !value} onClick={logNumber}>Log</Btn>
          </div>
        </Panel>
      </div>

      {/* TARGETS — the goal side of his own numbers (was set-able but never shown) */}
      <Divider />
      <SectionLabel>Your targets</SectionLabel>
      <div style={{ height: ".9rem" }} />
      {data.targets.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: ".5rem", marginBottom: ".9rem" }}>
          {data.targets.map((t) => (
            <div key={t.id} className="au-lrow" style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "1rem" }}>
              <span style={{ color: "var(--ink)", textTransform: "capitalize" }}>
                {t.label} → <b>{t.targetValue}{t.unit ?? ""}</b>
                {t.targetDate && <span style={{ color: "var(--ink3)", fontSize: 13 }}> by {new Date(t.targetDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>}
              </span>
              <span style={{ fontVariantNumeric: "tabular-nums", color: "var(--ink2)" }}>
                {t.latestValue !== null && <span>{t.latestValue}{t.unit ?? ""}{t.remaining ? ` · ${t.remaining} to go` : ""}</span>}
                <span style={{ color: PACE_TONE[t.pace] ?? "var(--ink3)", marginLeft: ".6em" }}>· {PACE_LABEL[t.pace] ?? t.pace}</span>
              </span>
            </div>
          ))}
        </div>
      )}
      <Panel tier="glass">
        <div style={{ display: "flex", flexWrap: "wrap", gap: ".5rem", alignItems: "center" }}>
          <input value={tLabel} onChange={(e) => setTLabel(e.target.value)} placeholder="goal (e.g. vertical)" style={inputStyle} />
          <input value={tValue} onChange={(e) => setTValue(e.target.value)} placeholder="target" inputMode="decimal" style={{ ...inputStyle, width: 90 }} />
          <input value={tUnit} onChange={(e) => setTUnit(e.target.value)} placeholder="unit" style={{ ...inputStyle, width: 80 }} />
          <input value={tDate} onChange={(e) => setTDate(e.target.value)} type="date" style={{ ...inputStyle, width: 150 }} />
          <Btn disabled={tBusy || !tLabel.trim() || !tValue} onClick={setTargetGoal}>Set goal</Btn>
        </div>
      </Panel>

      {/* WORKOUT SHEET — the same program-delivery layer as the athletes, pointed at Cole */}
      <Divider />
      <SectionLabel>Your workout sheet</SectionLabel>
      <div style={{ height: ".9rem" }} />
      {data.sheetUrl ? (
        <div className="au-lrow" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
          <a href={data.sheetUrl} target="_blank" rel="noreferrer" style={{ color: "var(--money)", wordBreak: "break-all" }}>
            Open your training sheet ↗
          </a>
          <button className="au-btn-ghost" disabled={sheetBusy} onClick={() => { setSheet(""); saveSheet(); }} style={ghostBtn}>
            Unlink
          </button>
        </div>
      ) : (
        <Panel tier="glass">
          <p style={{ color: "var(--ink2)", margin: "0 0 .7rem" }}>
            Link your own Google Sheet — the same program-delivery surface your athletes use, kept on your own record.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: ".5rem", alignItems: "center" }}>
            <input value={sheet} onChange={(e) => setSheet(e.target.value)} placeholder="https://docs.google.com/spreadsheets/d/…" style={{ ...inputStyle, flex: 1, minWidth: 240 }} />
            <Btn disabled={sheetBusy || !sheet.trim()} onClick={saveSheet}>Link</Btn>
          </div>
        </Panel>
      )}

      {/* n=1 SELF-EXPERIMENTS — Cole testing on himself, with an honest verdict */}
      <Divider />
      <SectionLabel>Self-experiments</SectionLabel>
      <div style={{ height: ".9rem" }} />
      {data.experiments.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: ".7rem", marginBottom: ".9rem" }}>
          {data.experiments.map((e) => (
            <div key={e.id} className="au-card" style={{ padding: ".8rem 1rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "1rem", flexWrap: "wrap" }}>
                <span style={{ color: "var(--ink)", fontWeight: 600 }}>{e.hypothesis}</span>
                <span style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: ".05em", color: e.status === "running" ? "var(--attn)" : "var(--ink3)" }}>{e.status}</span>
              </div>
              <div style={{ color: "var(--ink3)", fontSize: 13, marginTop: ".25rem", fontVariantNumeric: "tabular-nums" }}>
                {e.metricLabel}
                {e.baselineValue !== null && <> · baseline {e.baselineValue}</>}
                {e.resultValue !== null && <> → {e.resultValue}</>}
              </div>
              {e.verdict && <p style={{ color: "var(--ink2)", fontSize: 14, margin: ".6rem 0 0" }}>{e.verdict}</p>}
              {e.status === "running" && (
                <div style={{ marginTop: ".6rem", display: "flex", gap: ".5rem" }}>
                  <button className="au-btn-ghost" disabled={expBusy} onClick={() => concludeExperiment(e.id)} style={ghostBtn}>Conclude</button>
                  <button className="au-btn-ghost" disabled={expBusy} onClick={() => abandonExperiment(e.id)} style={{ ...ghostBtn, color: "var(--ink3)" }}>Abandon</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      <Panel tier="glass">
        <p style={{ color: "var(--ink2)", margin: "0 0 .7rem" }}>
          Test one thing on yourself the way you&apos;d test it on an athlete — a hypothesis, the metric to watch, an honest n=1 verdict at the end (a signal, never proof). It captures your current number as the baseline, so log the metric first.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: ".5rem", alignItems: "center" }}>
          <input value={hypothesis} onChange={(e) => setHypothesis(e.target.value)} placeholder="hypothesis (e.g. creatine raises my vertical)" style={{ ...inputStyle, flex: 1, minWidth: 220 }} />
          <input value={expMetric} onChange={(e) => setExpMetric(e.target.value)} placeholder="metric (e.g. vertical)" style={{ ...inputStyle, width: 150 }} />
          <input value={expEnd} onChange={(e) => setExpEnd(e.target.value)} type="date" style={{ ...inputStyle, width: 150 }} />
          <Btn disabled={expBusy || !hypothesis.trim() || !expMetric.trim()} onClick={startExperiment}>Start</Btn>
        </div>
      </Panel>

      {/* TRAJECTORY — dev curves */}
      {data.curves.some((c) => c.trajectory !== "insufficient") && (
        <>
          <Divider />
          <SectionLabel>Where you&apos;re heading</SectionLabel>
          <div style={{ height: ".9rem" }} />
          <div style={{ display: "flex", flexDirection: "column", gap: ".5rem" }}>
            {data.curves.filter((c) => c.trajectory !== "insufficient").map((c) => (
              <div key={c.measure} className="au-lrow" style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "1rem" }}>
                <span style={{ color: "var(--ink)", textTransform: "capitalize" }}>{c.measure}</span>
                <span style={{ fontVariantNumeric: "tabular-nums", color: "var(--ink2)" }}>
                  {c.projected90d !== null && <span>~{c.projected90d}{c.unit ?? ""} in 90d</span>}
                  <span style={{ color: TRAJ_TONE[c.trajectory] ?? "var(--ink3)", marginLeft: ".6em", textTransform: "capitalize" }}>· {c.trajectory}</span>
                </span>
              </div>
            ))}
          </div>
          <p className="au-kicker" style={{ display: "block", marginTop: "1rem", fontSize: 13, color: "var(--ink3)" }}>
            Projections from your own trend — a shape to aim at, not a promise.
          </p>
        </>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  background: "var(--bg1)", border: "1px solid var(--line1)", borderRadius: 6,
  padding: ".45rem .6rem", color: "var(--ink)", fontSize: 14,
};

const ghostBtn: React.CSSProperties = {
  background: "transparent", border: "1px solid var(--line1)", borderRadius: 6,
  padding: ".35rem .7rem", color: "var(--ink2)", fontSize: 13, cursor: "pointer",
};
