"use client";
// components/kit/AthleteRadar — THE ATHLETE RADAR (REDESIGN_PLAN.md
// §Instruments 2). A spider chart in the engraving grammar: fixed axis order,
// rings at r=42/74/106/138 (106 = THE STANDARD, heavier, carries the ring
// word), spokes at .5px, the value polygon in gold-bright drawn in via the
// pathLength trick, PR vertices bigger with a laurel ✦ in the label, and a
// dashed ghost for the prior assessment. Honest gates: fewer than 3 axes is
// never a fake polygon — 2 axes render the TWIN MERIDIAN (two opposing 150°
// arc gauges on the same engraved circle); fewer than 2 is the blank
// instrument, "AWAITING FIRST ASSESSMENT". Zero fetch — the page feeds it.
import React, { useEffect, useId, useState } from "react";

export type RadarAxis = {
  label: string; // axis name, engraved outside the limb
  display: string; // the human value, e.g. "31″" or "4.90s"
  r: number; // 0–150 normalized radius (106 = the standard ring)
  pr?: boolean; // personal best → bigger vertex + laurel in the label
};

const CX = 170, CY = 170;
const TAU = Math.PI * 2;
const RINGS = [42, 74, 138] as const; // eng1 hairlines; 106 drawn separately
const STANDARD_R = 106;
const rad = (d: number) => (d * Math.PI) / 180;
/* 0° = top, clockwise — the fixed axis law */
const pt = (r: number, deg: number): [number, number] => [
  CX + r * Math.sin(rad(deg)),
  CY - r * Math.cos(rad(deg)),
];
const arcPath = (r: number, a0: number, a1: number) => {
  const [x0, y0] = pt(r, a0);
  const [x1, y1] = pt(r, a1);
  return `M${x0.toFixed(2)} ${y0.toFixed(2)} A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
};
const clampR = (r: number) => Math.max(0, Math.min(150, r));

const SERIF = "var(--font-serif), Georgia, serif";
const DATA = "var(--font-data), 'Arial Narrow', sans-serif";

export function AthleteRadar({ axes, priorR, centerWord }: {
  axes: RadarAxis[];
  priorR?: number[]; // prior assessment, aligned to axes — the dashed ghost
  centerWord?: string; // Cinzel gold-gradient word at the center
}) {
  // "run" = animate draw-ins; "static" = reduced motion → final state at once.
  const [phase, setPhase] = useState<"idle" | "run" | "static">("idle");
  useEffect(() => {
    if (typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setPhase("static");
      return;
    }
    // Double rAF: first paint lands with dashoffset = full length, then the
    // transition carries it to zero — the engraving draws itself in.
    let raf = requestAnimationFrame(() => {
      raf = requestAnimationFrame(() => setPhase("run"));
    });
    return () => cancelAnimationFrame(raf);
  }, [axes.length]);

  const drawn = phase !== "idle";
  const dash = (len: number, dur: number, delay = 0): React.CSSProperties => ({
    strokeDasharray: len,
    strokeDashoffset: drawn ? 0 : len,
    transition: phase === "run" ? `stroke-dashoffset ${dur}ms var(--au-ease) ${delay}ms` : "none",
  });

  const uid = useId().replace(/[^a-zA-Z0-9-]/g, "");
  const ringWordId = `stdring-${uid}`;
  const goldTextId = `goldtext-${uid}`;

  const n = axes.length;
  const deg = (i: number) => (i * 360) / n;

  /* ── shared engraved chassis: the four rings + the standard's ring word ── */
  const chassis = (
    <>
      {RINGS.map((r, i) => (
        <circle key={r} cx={CX} cy={CY} r={r} fill="none" stroke="var(--eng1)" strokeWidth={0.5}
          style={dash(TAU * r, 1000, i * 120)} />
      ))}
      {/* THE STANDARD — heavier, last, slowest */}
      <circle cx={CX} cy={CY} r={STANDARD_R} fill="none" stroke="var(--eng2)" strokeWidth={1}
        style={dash(TAU * STANDARD_R, 1000, 480)} />
      <defs>
        <path id={ringWordId}
          d={`M ${CX} ${CY - STANDARD_R} A ${STANDARD_R} ${STANDARD_R} 0 1 1 ${CX - 0.01} ${CY - STANDARD_R}`}
          fill="none" />
        <linearGradient id={goldTextId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f2d377" />
          <stop offset=".55" stopColor="#d4af37" />
          <stop offset="1" stopColor="#8a6f22" />
        </linearGradient>
      </defs>
      <text fill="var(--gold-dim)" opacity={0.55}
        style={{ fontFamily: DATA, fontSize: 8.5, letterSpacing: ".5em" }}>
        <textPath href={`#${ringWordId}`} startOffset="26%">THE STANDARD</textPath>
      </text>
    </>
  );

  const center = centerWord ? (
    <text x={CX} y={CY + 4} textAnchor="middle" fill={`url(#${goldTextId})`}
      style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 12.5, letterSpacing: ".2em" }}>
      {centerWord.toUpperCase()}
    </text>
  ) : null;

  /* axis label + value, engraved outside r150 */
  const axisLabel = (a: RadarAxis, lx: number, ly: number) => {
    const anchor = Math.abs(lx - CX) < 10 ? "middle" : lx > CX ? "start" : "end";
    return (
      <g key={`lab-${a.label}`}>
        <text x={lx} y={ly + (ly > CY ? 10 : 0)} textAnchor={anchor} fill="var(--ink3)"
          style={{ fontFamily: DATA, fontSize: 10.5, letterSpacing: ".18em" }}>
          {a.label.toUpperCase()}{a.pr ? " ✦" : ""}
        </text>
        <text x={lx} y={ly + (ly > CY ? 24 : 14)} textAnchor={anchor} fill="var(--ink2)"
          style={{ fontFamily: DATA, fontSize: 11, letterSpacing: ".04em", fontVariantNumeric: "tabular-nums" }}>
          {a.display}
        </text>
      </g>
    );
  };

  let body: React.ReactNode;
  if (n < 2) {
    /* ── BLANK INSTRUMENT — nothing measured yet, and it says so ── */
    body = (
      <text x={CX} y={CY + 4} textAnchor="middle" fill="var(--ink3)"
        style={{ fontFamily: "var(--font-body), Georgia, serif", fontWeight: 600, fontSize: 11.5, letterSpacing: ".3em", textTransform: "uppercase" }}>
        AWAITING FIRST ASSESSMENT
      </text>
    );
  } else if (n < 3) {
    /* ── TWIN MERIDIAN — two metrics is a pair of gauges, never a fake polygon.
          Two opposing 150° arcs: left = axes[0], right = axes[1]. ── */
    const GR = 120; // gauge track radius
    const SPAN = 150;
    const gauges = [
      { a: axes[0], start: 345, side: "left" as const }, // through 270° (west)
      { a: axes[1], start: 15, side: "right" as const }, // through 90° (east)
    ];
    body = (
      <>
        {gauges.map(({ a, start, side }, gi) => {
          const frac = clampR(a.r) / 150;
          const stdFrac = STANDARD_R / 150;
          const end = start + SPAN;
          const valEnd = start + SPAN * frac;
          const [lx, ly] = pt(161, start + SPAN / 2);
          return (
            <g key={`g-${side}`}>
              {/* the track */}
              <path d={arcPath(GR, start, end)} fill="none" stroke="var(--eng1)" strokeWidth={1}
                style={dash(TAU * GR * (SPAN / 360), 900, 300 + gi * 150)} />
              {/* the standard's notch on the track */}
              <path d={arcPath(GR, start + SPAN * stdFrac - 1, start + SPAN * stdFrac + 1)}
                fill="none" stroke="var(--eng2)" strokeWidth={7} />
              {/* the value arc */}
              {frac > 0 && (
                <path d={arcPath(GR, start, valEnd)} fill="none" stroke="var(--gold-bright)"
                  strokeWidth={1.25} strokeLinecap="round"
                  style={dash(TAU * GR * ((SPAN * frac) / 360), 950, 900 + gi * 150)} />
              )}
              <circle cx={pt(GR, valEnd)[0]} cy={pt(GR, valEnd)[1]} r={a.pr ? 3.4 : 2.4}
                fill={a.pr ? "var(--gold-bright)" : "var(--gold)"} />
              {axisLabel(a, lx, ly)}
            </g>
          );
        })}
        {center}
      </>
    );
  } else {
    /* ── THE FULL RADAR ── */
    const shapeD = `M${axes
      .map((a, i) => pt(clampR(a.r), deg(i)).map((v) => v.toFixed(1)).join(" "))
      .join(" L")} Z`;
    const ghost =
      priorR && priorR.length === n
        ? `M${priorR
            .map((r, i) => pt(clampR(r), deg(i)).map((v) => v.toFixed(1)).join(" "))
            .join(" L")} Z`
        : null;
    body = (
      <>
        {/* spokes */}
        {axes.map((a, i) => {
          const [x2, y2] = pt(150, deg(i));
          return <line key={`sp-${a.label}`} x1={CX} y1={CY} x2={x2} y2={y2} stroke="var(--eng1)" strokeWidth={0.5} />;
        })}
        {/* prior ghost — where he stood last time */}
        {ghost && (
          <path d={ghost} stroke="var(--gold-dim)" strokeWidth={0.5} strokeDasharray="3 3"
            fill="none" opacity={0.7} />
        )}
        {/* the shape — drawn in via the pathLength trick */}
        <path d={shapeD} stroke="var(--gold-bright)" strokeWidth={1.25} strokeLinejoin="round"
          fill="rgba(212,175,55,.07)" pathLength={1}
          style={{
            strokeDasharray: 1,
            strokeDashoffset: drawn ? 0 : 1,
            fillOpacity: drawn ? 1 : 0,
            transition:
              phase === "run"
                ? "stroke-dashoffset .95s var(--au-ease) .9s, fill-opacity .5s ease 1.8s"
                : "none",
          }} />
        {/* vertices + labels */}
        {axes.map((a, i) => {
          const [vx, vy] = pt(clampR(a.r), deg(i));
          const [lx, ly] = pt(161, deg(i));
          return (
            <g key={`v-${a.label}`}>
              <circle cx={vx} cy={vy} r={a.pr ? 3.4 : 2.4} fill={a.pr ? "var(--gold-bright)" : "var(--gold)"} />
              {axisLabel(a, lx, ly)}
            </g>
          );
        })}
        {center}
      </>
    );
  }

  return (
    <svg viewBox="0 0 340 340" role="img" aria-label="The standard"
      style={{ width: "min(420px, 92vw)", height: "auto" }}>
      {chassis}
      {body}
    </svg>
  );
}

export default AthleteRadar;
