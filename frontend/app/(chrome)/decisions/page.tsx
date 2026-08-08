"use client";

// DECISIONS — the ruling bench. Everything awaiting Cole's ruling, one
// queue, one badge. Bridge signals/proposals (Confirm / Dismiss / That's
// wrong) and inbox triage (Today / Next / Later / Drop) are the same act
// to Cole: ruling.
//
// ELEVATED IMPERIAL re-dress: the bench hero carries the pending count as
// a Cinzel Roman numeral — the SAME number the tab badge shows (the badge
// endpoint and the deck split on the same predicate, so they can never
// disagree; SignalsBench reports its count up after every load and the
// numeral ticks via keyed remount). Tabs first, per the Executor — the two
// action models unify after real usage shows how they interleave.

import { useEffect, useState } from "react";
import SignalsBench from "../../../components/decisions/SignalsBench";
import TriageQueue from "../../../components/decisions/TriageQueue";

// 1–12 engrave as Roman numerals (the bench rarely holds more); anything
// larger — or zero — speaks plain arabic. Honest numbers, never ceremony
// past what the count deserves.
const ROMAN = ["Ⅰ", "Ⅱ", "Ⅲ", "Ⅳ", "Ⅴ", "Ⅵ", "Ⅶ", "Ⅷ", "Ⅸ", "Ⅹ", "Ⅺ", "Ⅻ"];
function romanize(n: number): string {
  return n >= 1 && n <= 12 ? ROMAN[n - 1] : String(n);
}

export default function DecisionsPage() {
  const [tab, setTab] = useState<"signals" | "triage">("signals");
  // null until the bench's first load lands — the hero never fakes a zero.
  const [benchCount, setBenchCount] = useState<number | null>(null);

  // Deep links (old /inbox redirects to ?tab=triage) land on the right tab.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("tab") === "triage") setTab("triage");
  }, []);

  const cleared = benchCount === 0;

  return (
    <div className="au-horizon space-y-6">
      {/* THE BENCH HERO — the count, engraved. Keyed span remounts on every
          change so the numeral ticks in (au-tickin) as cards are ruled away. */}
      <header className="text-center pt-2">
        <div
          className="au-title"
          style={{ fontSize: "clamp(3.4rem,10vw,5rem)", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}
          aria-live="polite"
          aria-label={
            benchCount === null
              ? "loading the bench"
              : cleared
                ? "the bench is clear"
                : `${benchCount} await your ruling`
          }
        >
          <span key={benchCount ?? "loading"} className="au-tickin">
            {benchCount === null ? "…" : cleared ? "—" : romanize(benchCount)}
          </span>
        </div>
        <div
          style={{
            fontFamily: "var(--font-body),Georgia,serif",
            fontWeight: 600,
            fontSize: 13,
            letterSpacing: ".32em",
            textTransform: "uppercase",
            color: "var(--ink3)",
            marginTop: ".4rem",
          }}
        >
          {cleared ? "the bench is clear — well ruled" : "await your ruling"}
        </div>
      </header>

      <nav className="flex justify-center gap-2 max-w-3xl mx-auto" aria-label="Decision queues">
        {(
          [
            { key: "signals", label: "From Aurelius" },
            { key: "triage", label: "Triage" },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            aria-pressed={tab === t.key}
            style={{ fontFamily: "var(--font-body),Georgia,serif" }}
            className={`font-semibold text-[13px] uppercase tracking-[.18em] px-4 py-2 rounded-[2px] border min-h-[44px] transition-colors ${
              tab === t.key
                ? "border-aurelius-gold/70 bg-aurelius-gold/10 text-aurelius-gold"
                : "border-aurelius-gold/20 text-neutral-500 hover:text-aurelius-gold hover:border-aurelius-gold/40"
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {/* The bench stays mounted behind the triage tab so the hero numeral
          keeps counting true while Cole triages. */}
      <div className={tab === "signals" ? "" : "hidden"}>
        <SignalsBench onPendingCount={setBenchCount} />
      </div>
      {tab === "triage" && <TriageQueue />}
    </div>
  );
}
