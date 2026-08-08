"use client";

// THE SECOND BRAIN — one door to everything Aurelius knows. Corpus +
// Library + Wiki were three pages named after database tables; Cole's
// question was always just "what does it know, and where do I put this?"
// Three tabs: Ask (the door — recall with citations + feed by note/URL),
// Shelves (the bookcase + Research Drop), Syntheses (the wiki it maintains).
//
// ELEVATED IMPERIAL re-dress: Ask becomes the LANDING state (the door),
// the tab row survives beneath it for the Shelves and the Wiki. Same
// panels, same fetches, same deep links. Re-dress, never delete.

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import ShelvesPanel from "../../../components/brain/ShelvesPanel";
import AskPanel from "../../../components/brain/AskPanel";
import WikiPanel from "../../../components/brain/WikiPanel";

const TABS = [
  { key: "ask", label: "Ask" },
  { key: "shelves", label: "Shelves" },
  { key: "wiki", label: "Syntheses" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

/* ── tab chip: engraved Cormorant caps, stone radius ── */
function TabChip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="min-h-[44px] px-4 py-2"
      style={{
        fontFamily: "var(--font-body),Georgia,serif", fontWeight: 600, fontSize: 13,
        letterSpacing: ".22em", textTransform: "uppercase", borderRadius: 2, cursor: "pointer",
        border: `1px solid ${on ? "var(--gold-line)" : "var(--line1)"}`,
        color: on ? "var(--gold)" : "var(--ink3)",
        background: on ? "rgba(212,175,55,.08)" : "none",
        transition: "color .15s, border-color .15s",
      }}
    >
      {children}
    </button>
  );
}

function BrainInner() {
  const [tab, setTab] = useState<TabKey>("ask");

  // Deep links keep working: /brain?ask=… (TopBar) lands on the Ask tab.
  // Keyed on the live search params (not mount-once): a ⌘K jump to
  // /brain?tab=… or ?ask=… while ALREADY on /brain must switch tabs.
  const searchParams = useSearchParams();
  useEffect(() => {
    if (searchParams.get("ask") !== null) setTab("ask");
    else {
      const t = searchParams.get("tab");
      if (t && TABS.some((x) => x.key === t)) setTab(t as TabKey);
    }
  }, [searchParams]);

  return (
    <div className="au-horizon space-y-6 pb-16">
      <header className="text-center pt-2 relative">
        <h1 className="au-title" style={{ fontSize: "clamp(2rem,5vw,2.6rem)", lineHeight: 1.1, margin: 0 }}>
          The Second Brain
        </h1>
        <p className="au-kicker" style={{ display: "block", marginTop: ".5rem", fontSize: "1.05rem", color: "var(--ink2)" }}>
          everything read, kept, and connected — ask it anything
        </p>
      </header>
      <nav className="flex justify-center gap-2 max-w-3xl mx-auto relative">
        {TABS.map((t) => (
          <TabChip key={t.key} on={tab === t.key} onClick={() => setTab(t.key)}>{t.label}</TabChip>
        ))}
      </nav>
      {tab === "ask" && <AskPanel />}
      {tab === "shelves" && <ShelvesPanel />}
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
