"use client";

// MOBILE TAB BAR — the phone chrome. Five thumb-reach destinations (iOS
// convention caps at five); everything else stays reachable through these
// pages. Targets ≥44px; safe-area padded for gesture-nav phones.
// ELEVATED IMPERIAL ruling: Chat takes tab 2 (the voice is the spine) and
// Business takes tab 4 (promoted per council — the funnel is the campaign);
// Calendar and Goals lead the More list and keep their sub-route highlights.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useNeedsYou } from "../../lib/useNeedsYou";

const TABS: Array<{ label: string; path: string; glyph: string }> = [
  { label: "Dashboard", path: "/home", glyph: "❂" },
  { label: "Chat", path: "/chat", glyph: "❧" },
  { label: "Decisions", path: "/decisions", glyph: "⇄" },
  { label: "Business", path: "/business", glyph: "◈" },
  { label: "More", path: "/more", glyph: "⋯" },
];

// The four primary destinations. "More" is the catch-all: it highlights whenever
// the current page is none of these — derived, not a hand-kept list, so a NEW
// page lights up More automatically instead of going un-highlighted until
// someone remembers to add it (the drift the audit flagged).
const PRIMARY_PATHS = TABS.filter((t) => t.path !== "/more").map((t) => t.path);
const matchesPath = (pathname: string, p: string) => pathname === p || pathname.startsWith(p + "/");

export default function MobileTabBar() {
  const pathname = usePathname();
  const needsYou = useNeedsYou();
  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-aurelius-gold/40 bg-black/95 backdrop-blur flex"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {TABS.map((t) => {
        const active =
          t.path === "/more"
            ? pathname !== "/" && !PRIMARY_PATHS.some((p) => matchesPath(pathname, p))
            : matchesPath(pathname, t.path);
        return (
          <Link
            key={t.path}
            href={t.path}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 min-h-[52px] text-[11px] tracking-wide ${
              active ? "text-aurelius-gold" : "text-neutral-500"
            }`}
          >
            <span className={`relative text-lg leading-none ${active ? "drop-shadow-[0_0_8px_rgba(212,175,55,0.5)]" : ""}`}>
              {t.glyph}
              {t.path === "/decisions" && needsYou > 0 && (
                <span className="absolute -top-1.5 -right-3 min-w-[16px] h-[16px] px-1 rounded-full bg-aurelius-gold text-black text-[10px] font-bold leading-[16px] text-center">
                  {needsYou > 9 ? "9+" : needsYou}
                </span>
              )}
            </span>
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
