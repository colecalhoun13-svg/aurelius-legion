"use client";

// DECISIONS — everything awaiting Cole's ruling, one queue, one badge.
// Bridge signals/proposals (Confirm / Dismiss / That's wrong) and inbox
// triage (Today / Next / Later / Drop) are the same act to Cole: ruling.
// Tabs first, per the Executor — the two action models unify after real
// usage shows how they interleave.

import { useEffect, useState } from "react";
import SignalsBench from "../../../components/decisions/SignalsBench";
import TriageQueue from "../../../components/decisions/TriageQueue";

export default function DecisionsPage() {
  const [tab, setTab] = useState<"signals" | "triage">("signals");

  // Deep links (old /inbox redirects to ?tab=triage) land on the right tab.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("tab") === "triage") setTab("triage");
  }, []);
  return (
    <div className="space-y-6">
      <nav className="flex justify-center gap-2 max-w-3xl mx-auto">
        {(
          [
            { key: "signals", label: "From Aurelius" },
            { key: "triage", label: "Triage" },
          ] as const
        ).map((t) => (
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
      {tab === "signals" && <SignalsBench />}
      {tab === "triage" && <TriageQueue />}
    </div>
  );
}
