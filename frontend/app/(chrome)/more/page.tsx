"use client";

// MORE — the phone's directory, mirroring the desktop sidebar's map: same
// items, same order, same glyphs, so a thing lives in the same place on
// both devices. Brain leads (it ceded tab 4 to Goals); Setup sits low.
// Nothing lives ONLY here — this is a listing, never a burial.

import Link from "next/link";

const GROUPS: Array<{ title: string; items: Array<{ name: string; path: string; glyph: string; desc: string }> }> = [
  {
    // The daily coaching surfaces — the tab bar's comment promises these lead
    // the More list, and Athletes shipped with no mobile door at all (rule 8:
    // built is not done, done is reachable).
    title: "The day",
    items: [
      { name: "Athletes", path: "/athletes", glyph: "⚔", desc: "The roster — trends, targets, PRs, sheets, session feedback" },
      { name: "Calendar", path: "/calendar", glyph: "▤", desc: "The week as Aurelius sees it" },
      { name: "Goals", path: "/goals", glyph: "◎", desc: "Campaigns and the scoreboard" },
    ],
  },
  {
    title: "Direction",
    items: [
      { name: "Brain", path: "/brain", glyph: "❈", desc: "The shelves, ask-anything, and the syntheses" },
      { name: "Business", path: "/business", glyph: "◆", desc: "The remote coaching business — leads, clients, and the money" },
      { name: "Aurelius", path: "/aurelius", glyph: "♛", desc: "Missions, the autonomy dial, and traces" },
    ],
  },
  {
    title: "Setup",
    items: [
      { name: "Tools", path: "/tools", glyph: "⚒", desc: "Integrations and what unlocks them" },
      { name: "Engines", path: "/engines", glyph: "⚙", desc: "Which minds answer which calls" },
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
