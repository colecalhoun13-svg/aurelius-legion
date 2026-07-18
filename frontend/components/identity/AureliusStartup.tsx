// ===============================================
// AURELIUS OS — STARTUP SEQUENCE
// The REAL crest (public/crest/aurelius-crest.png). A symmetric conic mask
// reveals it from the crossed stems up both branches — the LEAVES APPEAR — then
// the whole crest GLOWS BRIGHT, and FADES AWAY into the dashboard. Actual logo,
// no redraw.
// ===============================================

"use client";

import { useEffect, useState } from "react";

const ASSEMBLE_MS = 1750; // leaves appear (conic reveal) + flare at the tail — slower
const HOLD_MS = 500; // settled beat at full brightness
const FADE_MS = 950; // glow fades / content dissolves in

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
          width: "92vmin",
          height: "92vmin",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(212,175,55,0.28) 0%, rgba(212,175,55,0.08) 45%, rgba(0,0,0,0) 70%)",
        }}
      />
      {/* the ACTUAL logo, revealed leaf-by-leaf by the conic mask, then flaring */}
      <div className="relative animate-wreathAssemble" style={{ width: "min(86vmin, 860px)", height: "min(86vmin, 860px)" }}>
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
