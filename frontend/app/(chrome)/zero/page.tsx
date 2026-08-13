"use client";

// ATHLETE ZERO — Cole's own tab. His readiness (WHOOP), his numbers, and where
// they're heading — kept separate from the athletes he coaches. Same fetch →
// kit render pattern as the rest of the app; empty-honest (a section with no
// data says how to fill it, never fakes a number). Re-dress, never invent.

import { useCallback, useEffect, useState } from "react";
import { Divider, Panel, SectionLabel, Stat } from "../../../components/kit";

type Readiness = { recovery: number | null; hrv: number | null; restingHr: number | null; at: string | null };
type Series = {
  label: string; unit: string | null; count: number;
  latest: { value: number }; best: { value: number }; improvementPct: number | null;
  stalled: boolean; regressing: boolean;
};
type Curve = { measure: string; unit: string | null; ratePerWeek: number | null; projected90d: number | null; trajectory: string };
type ZeroData = {
  athlete: string;
  readiness: Readiness | null;
  whoop: { configured: boolean; reason: string | null };
  series: Series[];
  curves: Curve[];
  error?: string;
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
            No numbers logged for you yet. Log a lift or a test (chat: &ldquo;log my vertical 30in&rdquo;) and your trend starts here.
          </p>
        </Panel>
      )}

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
