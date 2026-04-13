"use client";

import React from "react";

export default function AureliusTheme({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen w-full"
      style={{
        // Global Aurelius Theme Tokens
        // These match your globals.css variables
        ["--aurelius-bg" as any]: "#0a0a0a",
        ["--aurelius-panel" as any]: "#111111",
        ["--aurelius-border" as any]: "rgba(255, 215, 0, 0.12)",
        ["--aurelius-text" as any]: "#e5e5e5",
        ["--aurelius-gold" as any]: "#d4af37",
        ["--aurelius-font-body" as any]: "Inter, sans-serif",
      }}
    >
      {children}
    </div>
  );
}
