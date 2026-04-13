// ===============================================
// AURELIUS OS 3.4 — STARTUP SCREEN
// Displays the full Aurelius Crest with a fade-in
// animation before loading the OS Chrome.
// ===============================================

"use client";

import { useEffect, useState } from "react";
import AureliusCrest from "./AureliusCrest";

export default function AureliusStartup({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setReady(true), 1400); // 1.4s boot animation
    return () => clearTimeout(timer);
  }, []);

  if (!ready) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-black">
        <div className="opacity-0 animate-fadeIn">
          <AureliusCrest size={180} />
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
