// ===============================================
// AURELIUS OS — STARTUP SEQUENCE
// The REAL crest (public/crest/aurelius-crest.png) appears LEAF BY LEAF:
// 25 soft-edged windows along the wreath's ring open in sequence from the
// crossed stems up both branches, the A resolves in the middle, brightness
// RISES as the wreath comes in, the whole crest flares gold — then fades away
// into the dashboard. Actual artwork; geometry verified frame-by-frame headless.
// ===============================================

"use client";

import { useEffect, useState } from "react";

// Ring geometry measured against the artwork (calibrated by render).
const CXP = 48.8; // ring center x (% of container)
const CYP = 47.5; // ring center y
const RX = 17.2; // ring radius x
const RY = 16.6; // ring radius y
const STEPS = 13; // nodes per branch, bottom cross → tip

const STEP_MS = 85; // per-leaf stagger
const A_DELAY_MS = STEPS * STEP_MS + 120; // the A resolves after the branches
const ASSEMBLE_MS = A_DELAY_MS + 900; // through the flare
const HOLD_MS = 450;
const FADE_MS = 950;

type Patch = { x: number; y: number; k: number };

function buildPatches(): Patch[] {
  const out: Patch[] = [];
  for (let k = 0; k < STEPS; k++) {
    const a = ((90 - (k / (STEPS - 1)) * 148) * Math.PI) / 180; // 90° (bottom) → -58° (tips)
    const xr = CXP + RX * Math.cos(a);
    const y = CYP + RY * Math.sin(a);
    const xl = 2 * CXP - xr;
    out.push({ x: +xr.toFixed(1), y: +y.toFixed(1), k });
    if (k > 0) out.push({ x: +xl.toFixed(1), y: +y.toFixed(1), k }); // mirrored branch, same beat
  }
  return out;
}
const PATCHES = buildPatches();

const CREST_URL = "/crest/aurelius-crest.png";

function leafMask(x: number, y: number, inner: number, outer: number): string {
  return `radial-gradient(circle at ${x}% ${y}%, #000 0 ${inner}%, transparent ${outer}%)`;
}

function layerStyle(x: number, y: number, inner: number, outer: number, delayMs: number): React.CSSProperties {
  const mask = leafMask(x, y, inner, outer);
  return {
    position: "absolute",
    inset: 0,
    backgroundImage: `url(${CREST_URL})`,
    backgroundSize: "contain",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
    WebkitMaskImage: mask,
    maskImage: mask,
    animationDelay: `${delayMs}ms`,
  };
}

type Phase = "assemble" | "dissolve" | "done";

export default function AureliusStartup({ children }: { children: React.ReactNode }) {
  const [phase, setPhase] = useState<Phase>("assemble");

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("dissolve"), ASSEMBLE_MS + HOLD_MS);
    const t2 = setTimeout(() => setPhase("done"), ASSEMBLE_MS + HOLD_MS + FADE_MS);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  const overlay = phase !== "done" && (
    <div
      className={`fixed inset-0 z-50 bg-black flex items-center justify-center pointer-events-none ${
        phase === "dissolve" ? "animate-bootFade" : ""
      }`}
    >
      {/* warm gold wash blooming behind the crest */}
      <div
        className="absolute animate-crestGlow"
        style={{
          width: "100vmin",
          height: "100vmin",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(212,175,55,0.28) 0%, rgba(212,175,55,0.08) 45%, rgba(0,0,0,0) 70%)",
        }}
      />
      {/* the crest stack: leaf windows open in sequence; the wrapper's brightness
          RISES with the assembly, then flares gold before the fade.
          translateX compensates for the artwork's ring center sitting at 48.8%
          of the image (not 50%) — without it the crest lands left of page center. */}
      <div
        className="relative animate-crestWarm"
        style={{ width: "min(97vmin, 970px)", height: "min(97vmin, 970px)", transform: "translateX(1.2%)" }}
      >
        {PATCHES.map((p, i) => (
          <div key={i} className="crest-leafwin" style={layerStyle(p.x, p.y, 6.5, 10, p.k * STEP_MS)} />
        ))}
        {/* the A, resolving in the middle once the branches are up
            (window sized 17/24 — render-verified to cover the full letterform) */}
        <div className="crest-leafwin" style={layerStyle(CXP, CYP, 17, 24, A_DELAY_MS)} />
      </div>
    </div>
  );

  return (
    <>
      {overlay}
      {phase === "dissolve" || phase === "done" ? (
        <div className={phase === "dissolve" ? "animate-contentDissolve" : ""}>{children}</div>
      ) : null}
    </>
  );
}
