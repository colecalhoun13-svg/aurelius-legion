"use client";

// AURELIUS — the system's own territory, one door with three rooms:
// Missions (what it's doing), Autonomy (what it may do — the dial and undo),
// Traces (what it did, step by step). The council's v2 ruling: one ♛ row in
// the nav instead of three scattered pages; the trust story reads in order.
// Same tab pattern as /brain, ?tab= deep-linkable (autonomy cards elsewhere
// link straight to /aurelius?tab=autonomy — the dial stays one tap away).

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import MissionsPanel from "../../../components/aurelius/MissionsPanel";
import AutonomyPanel from "../../../components/aurelius/AutonomyPanel";
import TracesPanel from "../../../components/aurelius/TracesPanel";

const TABS = [
  { key: "missions", label: "Missions" },
  { key: "autonomy", label: "Autonomy" },
  { key: "traces", label: "Traces" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

function AureliusInner() {
  const [tab, setTab] = useState<TabKey>("missions");

  // Keyed on the live search params (not mount-once): a ⌘K jump to ?tab=…
  // while ALREADY on this page must switch tabs (same-route nav ≠ remount).
  const searchParams = useSearchParams();
  useEffect(() => {
    const t = searchParams.get("tab");
    if (t && TABS.some((x) => x.key === t)) setTab(t as TabKey);
  }, [searchParams]);

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
      {tab === "missions" && <MissionsPanel />}
      {tab === "autonomy" && <AutonomyPanel />}
      {tab === "traces" && <TracesPanel />}
    </div>
  );
}

export default function AureliusPage() {
  return (
    <Suspense fallback={null}>
      <AureliusInner />
    </Suspense>
  );
}
