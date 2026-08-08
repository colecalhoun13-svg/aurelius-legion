"use client";

// THE TUNING ROOM — the system's own territory, one door with the dials:
// Missions (what it's doing), Keyholes (what it may do — the autonomy dial
// and undo), Rituals (when the spine fires), Traces (what it did, step by
// step, with the 7-day spine grid). Same tab pattern as before, ?tab=
// deep-linkable (autonomy cards elsewhere link straight to
// /aurelius?tab=autonomy — the dial stays one tap away).
//
// ELEVATED IMPERIAL re-dress (docs/REDESIGN_PLAN.md): every panel and
// handler survives; the outward levers render locked because no dial for
// them exists — publish, send, spend always ask.

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import MissionsPanel from "../../../components/aurelius/MissionsPanel";
import AutonomyPanel from "../../../components/aurelius/AutonomyPanel";
import TracesPanel from "../../../components/aurelius/TracesPanel";

const TABS = [
  { key: "missions", label: "Missions" },
  { key: "autonomy", label: "Keyholes" },
  { key: "rituals", label: "Rituals" },
  { key: "traces", label: "Traces" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

// THE RITUALS — the scheduled spine as built (core/schedules). No frontend
// route exposes listSchedules yet, so this list is STATIC and says so: no
// fake re-time buttons, no dead API calls. Re-timing happens through chat;
// whether each job actually fired is the live spine grid under Traces.
const SPINE: Array<{ t: string; name: string; note: string }> = [
  { t: "02:00", name: "Database backup", note: "verified nightly" },
  { t: "05:30", name: "Inbox triage", note: "drafts only — never sends" },
  { t: "06:00", name: "RSS sweep", note: "the reading comes to him" },
  { t: "06:30", name: "Market pulse", note: "the wealth shelf updates" },
  { t: "06:45", name: "Schedule protection", note: "acts if granted, else proposes" },
  { t: "07:00", name: "Morning briefing", note: "carries the risk line" },
  { t: "07:30", name: "Outreach sweep", note: "Gmail drafts, three per run" },
  { t: "08:00", name: "Initiative", note: "what moves the needle today" },
  { t: "13:00", name: "Midday check", note: "silent when on pace" },
  { t: "21:15", name: "Queue sweep", note: "keyhole backlog, stale proposals" },
  { t: "21:30", name: "Debrief", note: "names tomorrow's opening move" },
  { t: "Sun 09", name: "Weekend sweep", note: "research → the wiki" },
  { t: "Sun 17", name: "Persona observer", note: "how he speaks to you" },
  { t: "Sun 18", name: "Weekly planning", note: "the week, framed" },
  { t: "Sun 19", name: "Freshness sweep", note: "stale knowledge flagged" },
  { t: "Sun 20", name: "Scoreboard", note: "the numbers that must move" },
  { t: "Sun 21", name: "Decision curriculum", note: "your corrections become rules" },
  { t: "Sun 22", name: "Curriculum ingest", note: "two units, seven fields" },
];

function RitualsPanel() {
  return (
    <div className="max-w-3xl mx-auto space-y-6 aurelius-reveal">
      <div className="au-label">The rituals — the scheduled spine</div>
      <div>
        {SPINE.map((r) => (
          <div key={`${r.t}-${r.name}`} className="au-rit">
            <span className="au-rt">{r.t}</span>
            <span className="au-rn">{r.name}</span>
            <span className="au-kicker hidden sm:inline" style={{ fontSize: 13 }}>{r.note}</span>
          </div>
        ))}
        <div className="au-rit">
          <span className="au-rt" style={{ fontSize: ".85rem" }}>15 min</span>
          <span className="au-rn">Calendar sync</span>
          <span className="au-kicker hidden sm:inline" style={{ fontSize: 13 }}>every quarter hour</span>
        </div>
        <div className="au-rit">
          <span className="au-rt" style={{ fontSize: ".85rem" }}>10 min</span>
          <span className="au-rn">Paperless watch</span>
          <span className="au-kicker hidden sm:inline" style={{ fontSize: 13 }}>documents file themselves</span>
        </div>
      </div>
      <p className="au-kicker text-center" style={{ display: "block" }}>
        re-time from chat — “move my brief to 6:30” works from any page.
        Whether each one actually fired is the spine grid, under Traces.
      </p>
    </div>
  );
}

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
    <div className="au-horizon">
      <div className="pb-12 relative z-[1] space-y-8">
        <header className="text-center pt-2">
          <h1 className="au-title" style={{ fontSize: "clamp(2rem,5vw,2.6rem)", lineHeight: 1.1, margin: 0 }}>
            The Tuning Room
          </h1>
          <p className="au-kicker mt-2" style={{ display: "block", maxWidth: 620, marginLeft: "auto", marginRight: "auto" }}>
            every dial in your hand — publish, send, spend have no dial: they always ask
          </p>
        </header>

        <nav className="flex justify-center gap-2 max-w-3xl mx-auto flex-wrap">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className="uppercase min-h-[44px] px-4 py-2 rounded-[2px]"
              style={{
                fontFamily: "var(--font-body),Georgia,serif", fontWeight: 600, fontSize: 13,
                letterSpacing: ".22em", background: "none", cursor: "pointer",
                color: tab === t.key ? "var(--gold)" : "var(--ink3)",
                border: `1px solid ${tab === t.key ? "var(--gold-line)" : "var(--line1)"}`,
                borderBottom: tab === t.key ? "1px solid var(--gold)" : "1px solid var(--line1)",
              }}
            >
              {t.label}
            </button>
          ))}
        </nav>

        {tab === "missions" && <MissionsPanel />}
        {tab === "autonomy" && <AutonomyPanel />}
        {tab === "rituals" && <RitualsPanel />}
        {tab === "traces" && <TracesPanel />}
      </div>
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
