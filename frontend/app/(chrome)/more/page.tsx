"use client";

// MORE — the fold. Weekly visits and the engine room, one tap deep, so the
// daily nav stays five items a thumb can reach. Nothing was deleted; it
// just stopped pretending to be daily.

import Link from "next/link";

const GROUPS: Array<{ title: string; items: Array<{ name: string; path: string; glyph: string; desc: string }> }> = [
  {
    title: "Weekly",
    items: [
      { name: "Goals & Projects", path: "/goals", glyph: "◎", desc: "Big and small, with runway" },
      { name: "Aurelius", path: "/aurelius", glyph: "♛", desc: "Missions, patterns, background work" },
      { name: "Autonomy", path: "/autonomy", glyph: "🜍", desc: "Keyholes, track records, undo" },
    ],
  },
  {
    title: "The engine room",
    items: [
      { name: "Chat console", path: "/", glyph: "❯", desc: "The plain conversation view" },
      { name: "Tools", path: "/tools", glyph: "⚒", desc: "Integrations and what unlocks them" },
      { name: "Engines", path: "/engines", glyph: "⚙", desc: "Which minds answer which calls" },
      { name: "Traces", path: "/traces", glyph: "🜸", desc: "Every decision, step by step" },
      { name: "Settings", path: "/settings", glyph: "✦", desc: "Connections and preferences" },
    ],
  },
];

export default function MorePage() {
  return (
    <main className="text-aurelius-text max-w-2xl mx-auto space-y-8 aurelius-stagger">
      <header className="aurelius-rule">
        <h1 className="aurelius-heading text-4xl">More</h1>
      </header>
      {GROUPS.map((g) => (
        <section key={g.title} className="space-y-2">
          <h2 className="aurelius-heading text-sm text-aurelius-gold/70 tracking-widest">{g.title}</h2>
          <div className="space-y-2">
            {g.items.map((it) => (
              <Link
                key={it.path}
                href={it.path}
                className="flex items-center gap-4 aurelius-panel-frame border border-aurelius-gold/20 px-4 py-3.5 hover:border-aurelius-gold/50 hover:bg-aurelius-gold/5 transition-colors"
              >
                <span className="text-aurelius-gold/70 text-lg w-6 text-center">{it.glyph}</span>
                <span className="flex-1">
                  <span className="block text-sm text-aurelius-text">{it.name}</span>
                  <span className="block text-xs text-neutral-500">{it.desc}</span>
                </span>
                <span className="text-neutral-600">›</span>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}
