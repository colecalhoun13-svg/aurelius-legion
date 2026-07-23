"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import AureliusCrest from "../../components/identity/AureliusCrest";
import { operatorRegistry, OperatorDefinition } from "../../lib/operators/operatorRegistry";

const NAV_GLYPHS: Record<string, string> = {
  Dashboard: "◈",
  "Command Deck": "❂",
  Today: "☀",
  Inbox: "▤",
  Calendar: "◷",
  Tools: "⚒",
  Projects: "❖",
  Goals: "◎",
  Bridge: "⇄",
  Autonomy: "🜍",
  Aurelius: "♛",
  "Second Brain": "❈",
  Wiki: "✍",
  Library: "📖",
  Engines: "⚙",
  Traces: "🜸",
  Settings: "✦",
};

export default function Sidebar() {
  const pathname = usePathname();
  const navItems: OperatorDefinition[] = Object.values(operatorRegistry);

  return (
    <aside className="w-64 h-full border-r border-aurelius-gold/40 bg-black/70 flex flex-col shrink-0">
      {/* Crest header — big and glowing, per the mockup */}
      <div className="flex items-center justify-center py-7 border-b border-aurelius-gold/40">
        <div className="drop-shadow-[0_0_18px_rgba(212,175,55,0.35)]">
          <AureliusCrest size={132} />
        </div>
      </div>

      {/* Scrollable: 17 destinations outgrow short windows — without this,
          everything below the fold (Library, Engines, Traces, Settings)
          silently doesn't exist. */}
      <nav className="flex flex-col p-3 pt-4 space-y-1 flex-1 min-h-0 overflow-y-auto">
        {navItems.map((item) => {
          const active = pathname === item.path;

          return (
            <Link
              key={item.name}
              href={item.path}
              className={`flex items-center gap-3 px-3 py-2.5 rounded transition-colors ${
                active
                  ? "bg-gradient-to-r from-aurelius-gold/25 to-transparent text-aurelius-gold font-semibold border-l-2 border-aurelius-gold"
                  : "text-aurelius-text/90 hover:text-aurelius-gold hover:bg-aurelius-gold/5"
              }`}
            >
              <span className={active ? "text-aurelius-gold" : "text-aurelius-gold/50"}>
                {NAV_GLYPHS[item.name] ?? "•"}
              </span>
              {item.name}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
