"use client";

// MOBILE TAB BAR — the phone chrome. Five thumb-reach destinations (iOS
// convention caps at five); everything else stays reachable through these
// pages. Targets ≥44px; safe-area padded for gesture-nav phones.
// NOTE: tab targets update as the council merges land (Brain, Decisions, Home).

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS: Array<{ label: string; path: string; glyph: string; also?: string[] }> = [
  { label: "Home", path: "/deck", glyph: "❂" },
  { label: "Today", path: "/today", glyph: "☀" },
  { label: "Bridge", path: "/bridge", glyph: "⇄", also: ["/inbox"] },
  { label: "Chat", path: "/", glyph: "♛" },
  { label: "Brain", path: "/corpus", glyph: "❈", also: ["/library", "/wiki"] },
];

export default function MobileTabBar() {
  const pathname = usePathname();
  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-aurelius-gold/40 bg-black/95 backdrop-blur flex"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {TABS.map((t) => {
        const active = pathname === t.path || t.also?.some((a) => pathname.startsWith(a));
        return (
          <Link
            key={t.path}
            href={t.path}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 min-h-[52px] text-[11px] tracking-wide ${
              active ? "text-aurelius-gold" : "text-neutral-500"
            }`}
          >
            <span className={`text-lg leading-none ${active ? "drop-shadow-[0_0_8px_rgba(212,175,55,0.5)]" : ""}`}>
              {t.glyph}
            </span>
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
