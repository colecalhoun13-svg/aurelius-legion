"use client";

// THE BRAIN — one door to everything Aurelius knows. Corpus + Library +
// Wiki were three pages named after database tables; Cole's question was
// always just "what does it know, and where do I put this?" Three tabs:
// Shelves (the bookcase + Research Drop), Ask (recall with citations +
// feed by note/URL), Syntheses (the wiki it maintains).

import { Suspense, useEffect, useState } from "react";
import ShelvesPanel from "../../../components/brain/ShelvesPanel";
import AskPanel from "../../../components/brain/AskPanel";
import WikiPanel from "../../../components/brain/WikiPanel";

const TABS = [
  { key: "shelves", label: "Shelves" },
  { key: "ask", label: "Ask" },
  { key: "wiki", label: "Syntheses" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

function BrainInner() {
  const [tab, setTab] = useState<TabKey>("shelves");

  // Deep links keep working: /brain?ask=… (TopBar) lands on the Ask tab.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get("ask") !== null) setTab("ask");
    else if (p.get("tab") && TABS.some((t) => t.key === p.get("tab"))) setTab(p.get("tab") as TabKey);
  }, []);

  return (
    <div className="space-y-6">
      <nav className="flex justify-center gap-2 max-w-3xl mx-auto">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`aurelius-heading text-sm tracking-widest px-4 py-2 rounded-lg border min-h-[44px] ${
              tab === t.key
                ? "border-aurelius-gold/70 bg-aurelius-gold/15 text-aurelius-gold"
                : "border-aurelius-gold/20 text-neutral-500 hover:text-aurelius-gold hover:border-aurelius-gold/40"
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>
      {tab === "shelves" && <ShelvesPanel />}
      {tab === "ask" && <AskPanel />}
      {tab === "wiki" && <WikiPanel />}
    </div>
  );
}

export default function BrainPage() {
  return (
    <Suspense fallback={null}>
      <BrainInner />
    </Suspense>
  );
}
