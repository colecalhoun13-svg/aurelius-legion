"use client";

// MOBILE TAB BAR — the phone chrome. Five thumb-reach destinations (iOS
// convention caps at five); everything else stays reachable through these
// pages. Targets ≥44px; safe-area padded for gesture-nav phones.
// v2 ruling: Goals takes tab 4 — "+1" logging is a daily thumb gesture,
// while Brain's ask is already Home's chat box; Brain leads the More list.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useNeedsYou } from "../../lib/useNeedsYou";

const TABS: Array<{ label: string; path: string; glyph: string; also?: string[] }> = [
  { label: "Home", path: "/home", glyph: "❂" },
  { label: "Decisions", path: "/decisions", glyph: "⇄" },
  { label: "Calendar", path: "/calendar", glyph: "◷" },
  { label: "Goals", path: "/goals", glyph: "◎", also: ["/projects"] },
  { label: "More", path: "/more", glyph: "⋯", also: ["/brain", "/aurelius", "/autonomy", "/tools", "/engines", "/traces", "/settings"] },
];

export default function MobileTabBar() {
  const pathname = usePathname();
  const needsYou = useNeedsYou();
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
