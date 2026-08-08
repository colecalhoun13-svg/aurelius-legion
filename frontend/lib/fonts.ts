// frontend/lib/fonts.ts
//
// THE THREE VOICES (docs/REDESIGN_PLAN.md) — self-hosted at build time via
// next/font/local, so no runtime request and no CDN dependence. Jurisdictions:
//   CEREMONY  var(--font-serif)  Cinzel 700 — page titles + big numerals. Never a sentence.
//   HUMAN     var(--font-body)   Cormorant Garamond — labels, kickers, prose, buttons.
//   DATA      var(--font-data)   Barlow Condensed — dense numeric annotation ONLY.
import localFont from "next/font/local";

export const ceremony = localFont({
  src: [{ path: "../app/fonts/Cinzel-700.woff2", weight: "700", style: "normal" }],
  variable: "--font-serif",
  display: "swap",
  fallback: ["Georgia", "Times New Roman", "serif"],
});

export const human = localFont({
  src: [
    { path: "../app/fonts/CormorantGaramond-normal-500.woff2", weight: "500", style: "normal" },
    { path: "../app/fonts/CormorantGaramond-normal-600.woff2", weight: "600", style: "normal" },
    { path: "../app/fonts/CormorantGaramond-italic-500.woff2", weight: "500", style: "italic" },
  ],
  variable: "--font-body",
  display: "swap",
  fallback: ["Georgia", "serif"],
});

export const data = localFont({
  src: [
    { path: "../app/fonts/BarlowCondensed-600.woff2", weight: "600", style: "normal" },
    { path: "../app/fonts/BarlowCondensed-700.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-data",
  display: "swap",
  fallback: ["Arial Narrow", "sans-serif"],
});

export const fontVars = `${ceremony.variable} ${human.variable} ${data.variable}`;
