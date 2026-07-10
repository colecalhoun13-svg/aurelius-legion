// ===============================================
// AURELIUS OS 3.4 — STARTUP SEQUENCE
// The wreath flashes into existence center-stage (same size and
// position as the background watermark), holds a beat — then the
// overlay fades and the OS dissolves in around it, so the wreath
// reads as settling INTO the dashboard.
// ===============================================

"use client";

import { useEffect, useState } from "react";


const FLASH_MS = 1050; // matches wreathFlash
const HOLD_MS = 300;   // beat after lock-on
const FADE_MS = 900;   // overlay fade / content dissolve

type Phase = "boot" | "dissolve" | "done";

export default function AureliusStartup({ children }: { children: React.ReactNode }) {
  const [phase, setPhase] = useState<Phase>("boot");

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("dissolve"), FLASH_MS + HOLD_MS);
    const t2 = setTimeout(() => setPhase("done"), FLASH_MS + HOLD_MS + FADE_MS);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  // Boot overlay: black field + wreath at watermark size/position.
  const overlay = phase !== "done" && (
    <div
      className={`fixed inset-0 z-50 bg-black flex items-center justify-center pointer-events-none ${
        phase === "dissolve" ? "animate-bootFade" : ""
      }`}
    >
      <div className="absolute inset-0 flex items-center justify-center animate-wreathFlash opacity-0">
        <div className="relative" style={{ width: "108vmin", height: "108vmin" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/crest/aurelius-wreath.png" alt="" className="w-full h-full object-contain"
            style={{ filter: "sepia(0.4) saturate(0.7) brightness(0.75)" }} />
        </div>
      </div>
    </div>
  );

  return (
    <>
      {overlay}
      {phase !== "boot" && (
        <div className={phase === "dissolve" ? "animate-contentDissolve" : ""}>{children}</div>
      )}
    </>
  );
}
