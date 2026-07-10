// ===============================================
// AURELIUS OS 3.4 — STARTUP SCREEN
// The wreath drops from above, settles with a gold
// glow, holds a beat — then the OS chrome reveals.
// Runs once per full page load (layout mount).
// ===============================================

"use client";

import { useEffect, useState } from "react";
import AureliusCrest from "./AureliusCrest";

const DROP_MS = 1100; // matches crestDrop duration
const HOLD_MS = 700;  // beat after the wreath settles

export default function AureliusStartup({ children }: { children: React.ReactNode }) {
  const [phase, setPhase] = useState<"boot" | "reveal">("boot");

  useEffect(() => {
    const timer = setTimeout(() => setPhase("reveal"), DROP_MS + HOLD_MS);
    return () => clearTimeout(timer);
  }, []);

  if (phase === "boot") {
    return (
      <div className="w-full h-screen flex flex-col items-center justify-center bg-black overflow-hidden">
        <div className="animate-crestDrop opacity-0">
          <AureliusCrest size={180} />
        </div>
      </div>
    );
  }

  return <div className="animate-chromeReveal">{children}</div>;
}
