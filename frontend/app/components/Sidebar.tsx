"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import AureliusCrest from "../../components/identity/AureliusCrest";
import { operatorRegistry, OperatorDefinition } from "../../lib/operators/operatorRegistry";

const NAV_GLYPHS: Record<string, string> = {
  Morning: "❂",
  Chat: "❧",
  Decisions: "⇄",
  Business: "◈",
  Goals: "◎",
  Brain: "❈",
  Calendar: "◷",
  Machine: "⚙",
  Tuning: "♛",
  Tools: "⚒",
  Settings: "✦",
};

export default function Sidebar() {
  const pathname = usePathname();

  // Group in registry order — grouping is the streamlining: nine rows read
  // as four ideas, and nothing essential hides behind a fold on desktop.
  const groups: Array<{ title: string; items: OperatorDefinition[] }> = [];
  for (const item of Object.values(operatorRegistry)) {
    const g = groups.find((x) => x.title === item.group);
    if (g) g.items.push(item);
    else groups.push({ title: item.group, items: [item] });
  }

  return (
    <aside className="hidden md:flex w-64 h-full border-r border-aurelius-gold/40 bg-black/70 flex-col shrink-0">
      {/* Crest header — big and glowing, per the mockup */}
      <div className="flex items-center justify-center py-7 border-b border-aurelius-gold/40">
        <div className="drop-shadow-[0_0_18px_rgba(212,175,55,0.35)]">
          <AureliusCrest size={132} />
        </div>
      </div>

      {/* Scrollable so short laptop windows never silently hide Setup. */}
      <nav className="flex flex-col p-3 pt-4 flex-1 min-h-0 overflow-y-auto">
        {groups.map((g, gi) => (
          <div key={g.title} className={gi === 0 ? "" : "mt-4"}>
            <div className="px-3 pb-1 text-[10px] uppercase tracking-[0.2em] text-aurelius-gold/50 aurelius-heading">
              {g.title}
            </div>
            <div className="space-y-1">
              {g.items.map((item) => {
                const active = pathname === item.path;
                return (
                  <Link
                    key={item.name}
                    href={item.path}
                    title={item.description}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center gap-3 px-3 py-2 rounded-sm transition-colors border-l ${
                      active
                        ? "border-aurelius-gold bg-aurelius-gold/10 text-aurelius-gold"
                        : "border-transparent text-aurelius-text/90 hover:text-aurelius-gold hover:bg-aurelius-gold/5"
                    }`}
                  >
                    <span className={active ? "text-aurelius-gold" : "text-aurelius-gold/50"}>
                      {NAV_GLYPHS[item.name] ?? "•"}
                    </span>
                    {item.name}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
