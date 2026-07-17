// ===============================================
// AURELIUS OS — STARTUP SEQUENCE v2
// The wreath ASSEMBLES: stems draw upward while leaves unfurl in sequence
// up both branches until they meet at the tips — then the crest BLOOMS
// bright gold (radial wash + ring of light + the name), holds a beat, and
// slowly settles into the dashboard as the overlay fades. Pure SVG — no
// pixels at any size — and it lands exactly on the watermark's position,
// so the crest reads as settling INTO the field it lives on.
// ===============================================

"use client";

import { useEffect, useState } from "react";
import WreathSVG from "./WreathSVG";

const ASSEMBLE_MS = 1150; // stems + 14 staggered leaves per branch
const BLOOM_MS = 900;     // the meeting flash (starts just before assembly ends)
const HOLD_MS = 350;      // let the settled crest breathe
const FADE_MS = 900;      // overlay fade / content dissolve

const BLOOM_AT = ASSEMBLE_MS - 150; // bloom ignites AS the tips meet
const DISSOLVE_AT = BLOOM_AT + BLOOM_MS + HOLD_MS;
const DONE_AT = DISSOLVE_AT + FADE_MS;

type Phase = "assemble" | "bloom" | "dissolve" | "done";

export default function AureliusStartup({ children }: { children: React.ReactNode }) {
  const [phase, setPhase] = useState<Phase>("assemble");

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("bloom"), BLOOM_AT);
    const t2 = setTimeout(() => setPhase("dissolve"), DISSOLVE_AT);
    const t3 = setTimeout(() => setPhase("done"), DONE_AT);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, []);

  const blooming = phase === "bloom" || phase === "dissolve";

  const overlay = phase !== "done" && (
    <div
      className={`fixed inset-0 z-50 bg-black flex items-center justify-center pointer-events-none ${
        phase === "dissolve" ? "animate-bootFade" : ""
      }`}
    >
      {/* Radial gold wash — ignites behind the crest the moment the tips meet */}
      {blooming && (
        <div
          className="absolute animate-bloomWash"
          style={{
            width: "120vmin",
            height: "120vmin",
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(212,175,55,0.35) 0%, rgba(212,175,55,0.12) 40%, rgba(0,0,0,0) 70%)",
          }}
        />
      )}

      {/* A single ring of light expanding from the meeting moment */}
      {blooming && (
        <div
          className="absolute animate-ringPulse"
          style={{
            width: "88vmin",
            height: "88vmin",
            borderRadius: "50%",
            border: "1px solid rgba(212,175,55,0.55)",
            boxShadow: "0 0 30px rgba(212,175,55,0.25), inset 0 0 30px rgba(212,175,55,0.15)",
          }}
        />
      )}

      {/* The crest — assembling, then blooming, at watermark size/position */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className={`relative ${blooming ? "animate-wreathBloom" : ""}`}
          style={{ width: "108vmin", height: "108vmin" }}
        >
          <WreathSVG variant="gold" animated className="w-full h-full" />
        </div>
      </div>

      {/* The name arrives with the bloom */}
      {blooming && (
        <div
          className="absolute animate-titleIn"
          style={{
            fontFamily: "var(--font-serif, Georgia, serif)",
            fontSize: "clamp(1.4rem, 3.2vmin, 2.2rem)",
            color: "#e8d48b",
            textShadow: "0 0 24px rgba(212,175,55,0.45)",
            textTransform: "uppercase",
          }}
        >
          Aurelius
        </div>
      )}
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
