"use client";
// components/kit/DayDial — THE DAY DIAL (REDESIGN_PLAN.md §Instruments 1).
// A noon-top 24h sundial: limb circles draw in, the gnomon sweeps from
// midnight to now, calendar events sit on the r138 band (protected blocks
// wear gold rails), and the inner spine band shows the exocortex's day as
// ticks (solid = ran, hollow = due, red = failed). Pure inline SVG in the
// engraving grammar — strokes .5–1.25px, gold opacities from the eng vars.
// Honest-empty: no events / no calendar → bare band, "—", AWAITING THE
// CALENDAR. Zero fetch — the page feeds it.
import React, { useEffect, useMemo, useState } from "react";
import { useCountUp } from "./index";

export type DialEvent = { startISO: string; endISO: string; title: string; protected?: boolean };
export type SpineTick = { hour: number; state: "ran" | "due" | "fail" };

const CX = 180, CY = 180;
const TAU = Math.PI * 2;
/* the fixed angle law — noon at top, midnight at bottom */
const hDeg = (h: number) => (h - 12) * 15;
const rad = (d: number) => (d * Math.PI) / 180;
/* 0° = top, clockwise */
const pt = (r: number, deg: number): [number, number] => [
  CX + r * Math.sin(rad(deg)),
  CY - r * Math.cos(rad(deg)),
];
const arcPath = (r: number, a0: number, a1: number) => {
  const [x0, y0] = pt(r, a0);
  const [x1, y1] = pt(r, a1);
  return `M${x0.toFixed(2)} ${y0.toFixed(2)} A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
};

const SERIF = "var(--font-serif), Georgia, serif";
const BODY = "var(--font-body), Georgia, serif";
const DATA = "var(--font-data), 'Arial Narrow', sans-serif";

/* local wall-clock hour (0–24) from an ISO stamp; NaN-safe */
function isoHour(iso: string): number | null {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d.getHours() + d.getMinutes() / 60;
}

export function DayDial({ events, freeHours, nextLabel, spineTicks }: {
  events: DialEvent[];
  freeHours: number | null;
  nextLabel: string | null;
  spineTicks: SpineTick[];
}) {
  // "run" = animate draw-ins; "static" = reduced motion / pre-mount final state.
  const [phase, setPhase] = useState<"idle" | "run" | "static">("idle");
  // Gnomon angle in degrees; null until mount (new Date() in render would
  // desync the server prerender from the client — same hydration trap the
  // page's greeting hit).
  const [gnomonDeg, setGnomonDeg] = useState<number | null>(null);

  useEffect(() => {
    const reduced =
      typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    const now = new Date();
    const target = hDeg(now.getHours() + now.getMinutes() / 60);
    if (reduced) {
      setPhase("static");
      setGnomonDeg(target);
      return;
    }
    // Double rAF: first paint lands with dashoffset = full length, then the
    // transition carries it to zero — the engraving draws itself in.
    let raf = requestAnimationFrame(() => {
      raf = requestAnimationFrame(() => setPhase("run"));
    });
    // The gnomon sweeps midnight → now. 1.4s, easeOutCubic.
    const t0 = performance.now();
    const dur = 1400;
    const from = -180;
    let sweepRaf = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / dur);
      setGnomonDeg(from + (target - from) * (1 - Math.pow(1 - p, 3)));
      if (p < 1) sweepRaf = requestAnimationFrame(step);
    };
    sweepRaf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf);
      cancelAnimationFrame(sweepRaf);
    };
  }, []);

  const drawn = phase !== "idle";
  const dash = (len: number, dur: number, delay = 0): React.CSSProperties & Record<string, any> => ({
    strokeDasharray: len,
    strokeDashoffset: drawn ? 0 : len,
    transition: phase === "run" ? `stroke-dashoffset ${dur}ms var(--au-ease) ${delay}ms` : "none",
  });

  // Events → band arcs, clamped to today's face; garbage in, nothing out.
  const arcs = useMemo(() => {
    return events
      .map((ev) => {
        const s0 = isoHour(ev.startISO);
        let e0 = isoHour(ev.endISO);
        if (s0 == null || e0 == null) return null;
        if (e0 <= s0) e0 = 24; // crosses midnight → clamp to the day's edge
        const s = Math.max(0, Math.min(24, s0));
        const e = Math.max(0, Math.min(24, e0));
        if (e - s < 0.05) return null;
        return { s, e, title: ev.title, protected: !!ev.protected };
      })
      .filter((a): a is { s: number; e: number; title: string; protected: boolean } => a != null);
  }, [events]);

  const empty = arcs.length === 0 && freeHours == null;
  const hrs = useCountUp(freeHours ?? 0, 1300);

  // Elapsed shadow wedge, 00:00 → the gnomon (it follows the sweep).
  const shadowD = useMemo(() => {
    if (gnomonDeg == null) return null;
    const [sx, sy] = pt(168, -180);
    const [ex, ey] = pt(168, gnomonDeg);
    const large = gnomonDeg + 180 > 180 ? 1 : 0;
    return `M${CX} ${CY} L${sx.toFixed(2)} ${sy.toFixed(2)} A168 168 0 ${large} 1 ${ex.toFixed(2)} ${ey.toFixed(2)} Z`;
  }, [gnomonDeg]);

  const gnomon = gnomonDeg == null ? null : { a: pt(96, gnomonDeg), b: pt(172, gnomonDeg) };

  // 24 major ticks + quarter minors — static geometry.
  const ticks = useMemo(() => {
    const out: React.ReactNode[] = [];
    for (let h = 0; h < 24; h++) {
      const d = hDeg(h);
      const [x1, y1] = pt(168, d);
      const [x2, y2] = pt(162, d);
      out.push(<line key={`h${h}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--eng2)" strokeWidth={0.75} />);
      for (let q = 1; q < 4; q++) {
        const dq = hDeg(h + q / 4);
        const [a, b] = pt(168, dq);
        const [c, e] = pt(165.5, dq);
        out.push(<line key={`h${h}q${q}`} x1={a} y1={b} x2={c} y2={e} stroke="var(--eng1)" strokeWidth={0.5} />);
      }
    }
    return out;
  }, []);

  return (
    <svg
      viewBox="0 0 360 360"
      role="img"
      aria-label="The day"
      style={{ width: "min(360px, 88vw)", height: "auto", flex: "none" }}
    >
      {/* elapsed shadow — beneath everything */}
      {shadowD && <path d={shadowD} fill="rgba(212,175,55,.045)" />}

      {/* limb */}
      <circle cx={CX} cy={CY} r={168} fill="none" stroke="var(--eng2)" strokeWidth={0.6} style={dash(TAU * 168, 1200)} />
      <circle cx={CX} cy={CY} r={160} fill="none" stroke="var(--eng1)" strokeWidth={0.5} style={dash(TAU * 160, 1200, 120)} />

      {ticks}

      {/* Roman hours — Ⅵ dawn, Ⅻ noon, ⅩⅧ dusk, a small midnight Ⅻ */}
      {([[6, "Ⅵ"], [12, "Ⅻ"], [18, "ⅩⅧ"], [0, "Ⅻ"]] as [number, string][]).map(([h, t]) => {
        const [x, y] = pt(148, hDeg(h));
        return (
          <text key={`rn${h}`} x={x} y={y + 4} textAnchor="middle" fill="var(--gold-dim)"
            style={{ fontFamily: SERIF, fontSize: h === 0 ? 9 : 11.5 }}>
            {t}
          </text>
        );
      })}

      {/* event band — bare when the calendar is silent */}
      <circle cx={CX} cy={CY} r={138} fill="none" stroke="var(--line1)" strokeWidth={13} />
      {arcs.map((ev, i) => {
        const len = TAU * 138 * ((ev.e - ev.s) / 24);
        return (
          <g key={`ev${i}`}>
            <path d={arcPath(138, hDeg(ev.s), hDeg(ev.e))} stroke="rgba(212,175,55,.26)" strokeWidth={13}
              fill="none" style={dash(len, 700, 600 + i * 90)}>
              <title>{ev.title}</title>
            </path>
            {ev.protected &&
              [131.5, 144.5].map((r) => (
                <path key={`rail${i}-${r}`} d={arcPath(r, hDeg(ev.s), hDeg(ev.e))} stroke="var(--gold-bright)"
                  strokeWidth={0.5} fill="none" opacity={0.8}
                  style={dash(TAU * r * ((ev.e - ev.s) / 24), 700, 800)} />
              ))}
          </g>
        );
      })}

      {/* spine band — the exocortex's day */}
      <circle cx={CX} cy={CY} r={112} fill="none" stroke="var(--eng1)" strokeWidth={0.5} />
      {spineTicks.map((t, i) => {
        if (!Number.isFinite(t.hour)) return null;
        const d = hDeg(((t.hour % 24) + 24) % 24);
        const [x1, y1] = pt(107, d);
        const [x2, y2] = pt(117, d);
        const stroke = t.state === "ran" ? "var(--gold)" : t.state === "fail" ? "var(--danger)" : "var(--ink3)";
        return (
          <line key={`sp${i}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke={stroke}
            strokeWidth={t.state === "due" ? 0.75 : 1}
            opacity={t.state === "ran" ? 0.85 : t.state === "fail" ? 0.9 : 0.45} />
        );
      })}

      {/* gnomon — appears once the client knows the hour */}
      {gnomon && (
        <>
          <line x1={gnomon.a[0]} y1={gnomon.a[1]} x2={gnomon.b[0]} y2={gnomon.b[1]}
            stroke="var(--gold-bright)" strokeWidth={1} />
          <circle cx={gnomon.b[0]} cy={gnomon.b[1]} r={2.2} fill="var(--gold-bright)" />
        </>
      )}

      {/* center — the free-hours figure, or the honest empty */}
      <text x={CX} y={CY - 2} textAnchor="middle" fill="var(--ink)"
        style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 40, fontVariantNumeric: "tabular-nums" }}>
        {freeHours == null ? (
          "—"
        ) : (
          <>
            {hrs.toFixed(1)}
            <tspan fill="var(--gold)" style={{ fontSize: 17 }} dy={-14}>ʰ</tspan>
          </>
        )}
      </text>
      <text x={CX} y={CY + 24} textAnchor="middle" fill="var(--ink3)"
        style={{ fontFamily: BODY, fontWeight: 600, fontSize: 11.5, letterSpacing: ".3em", textTransform: "uppercase" }}>
        {empty ? "AWAITING THE CALENDAR" : "YOURS TODAY"}
      </text>
      {!empty && nextLabel && (
        <text x={CX} y={CY + 44} textAnchor="middle" fill="var(--ink3)"
          style={{ fontFamily: DATA, fontSize: 10.5, letterSpacing: ".12em" }}>
          {nextLabel}
        </text>
      )}
    </svg>
  );
}

export default DayDial;
