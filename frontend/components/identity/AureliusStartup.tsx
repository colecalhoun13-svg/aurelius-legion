// ===============================================
// AURELIUS OS — STARTUP SEQUENCE
// The REAL crest (public/crest/aurelius-crest.png — the gold laurel + A) glows
// up out of black, flares once, holds a beat, then dissolves into the dashboard.
// No redrawn art — the actual logo, displayed at a size that stays crisp.
// ===============================================

"use client";

import { useEffect, useState } from "react";

const RISE_MS = 1100; // crest fades/scales up + glow builds
const HOLD_MS = 550; // settled beat
const FADE_MS = 900; // overlay fade / content dissolve

type Phase = "rise" | "dissolve" | "done";

export default function AureliusStartup({ children }: { children: React.ReactNode }) {
  const [phase, setPhase] = useState<Phase>("rise");

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("dissolve"), RISE_MS + HOLD_MS);
    const t2 = setTimeout(() => setPhase("done"), RISE_MS + HOLD_MS + FADE_MS);
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
      <div className="absolute animate-crestGlow"
        style={{
          width: "80vmin", height: "80vmin", borderRadius: "50%",
          background: "radial-gradient(circle, rgba(212,175,55,0.28) 0%, rgba(212,175,55,0.08) 45%, rgba(0,0,0,0) 70%)",
        }}
      />
      {/* the ACTUAL logo — sized to stay crisp (source is 1536px) */}
      <div className="relative animate-crestRise" style={{ width: "min(74vmin, 740px)", height: "min(74vmin, 740px)" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/crest/aurelius-crest.png" alt="Aurelius" className="w-full h-full object-contain" />
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
