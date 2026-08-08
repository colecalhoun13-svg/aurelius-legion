"use client";

// THE CAMPAIGN — the numbers that must move, one door with three rooms:
// Goals (log progress), Projects (runway), Scoreboard (did the number go
// up — the coach's wall of trends). Same ?tab= pattern as /brain.
//
// ELEVATED IMPERIAL re-dress (docs/REDESIGN_PLAN.md): same tabs, same
// fetches, same handlers — new surfaces. The hero stats derive ONLY from
// what /api/scoreboard actually returns; a stat with no data is omitted,
// never faked. Re-dress, never delete.

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import ProjectsSection from "../../../components/ProjectsSection";
import ScoreboardPanel from "../../../components/goals/ScoreboardPanel";
import { Btn, Divider, Panel, Stat } from "../../../components/kit";

type Goal = {
  id: string; name: string; domain: string; horizon: string; progressPct: number; measure: any;
  targetDate?: string | null; createdAt?: string;
};

// Pace vs the clock — the Scoreboard's judgment, moved to where the +1
// happens (alignment council: anticipation belongs at the point of action).
function paceNote(g: Goal): { text: string; color: string } | null {
  if (!g.targetDate || !g.createdAt) return null;
  const total = new Date(g.targetDate).getTime() - new Date(g.createdAt).getTime();
  if (total <= 0) return null;
  const timePct = Math.min(100, Math.round(((Date.now() - new Date(g.createdAt).getTime()) / total) * 100));
  const pct = g.progressPct ?? 0;
  return pct >= timePct
    ? { text: `on pace — ${pct}% done, ${timePct}% of time`, color: "var(--money)" }
    : { text: `behind — ${pct}% done, ${timePct}% of time`, color: "var(--attn)" };
}

function localDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const HORIZON_ORDER = ["life", "year", "quarter"];
const HORIZON_LABEL: Record<string, string> = { life: "Life", year: "This Year", quarter: "This Quarter" };

/* ── the campaign hero — honest stats only, from the scoreboard feed the
      page already draws on (its Scoreboard tab hits the same endpoint).
      Anything the feed can't answer simply doesn't render. ── */
type HeroFeed = {
  weeks: { followThrough: number | null }[];
  doneTimestamps: string[];
  habits: { id: string; name: string; streak: number }[];
  goals: Goal[];
};

function CampaignHero() {
  const [feed, setFeed] = useState<HeroFeed | null>(null);

  useEffect(() => {
    fetch("/api/scoreboard")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (j) setFeed(j); })
      .catch(() => {}); // the hero simply doesn't render — the goals below say if the brain is unreachable
  }, []);

  if (!feed) return null;

  const latest = feed.weeks?.[feed.weeks.length - 1];
  const ft = latest?.followThrough ?? null;
  const habits = feed.habits ?? [];
  const bestStreak = habits.reduce((m, h) => Math.max(m, h.streak ?? 0), 0);
  const paced = (feed.goals ?? []).filter((g) => {
    if (!g.targetDate || !g.createdAt) return false;
    return new Date(g.targetDate).getTime() - new Date(g.createdAt).getTime() > 0;
  });
  const onPace = paced.filter((g) => {
    const total = new Date(g.targetDate!).getTime() - new Date(g.createdAt!).getTime();
    const timePct = Math.min(100, Math.round(((Date.now() - new Date(g.createdAt!).getTime()) / total) * 100));
    return (g.progressPct ?? 0) >= timePct;
  }).length;
  const cutoff = Date.now() - 14 * 86400_000;
  const done14 = (feed.doneTimestamps ?? []).filter((ts) => new Date(ts).getTime() >= cutoff).length;

  const stats: React.ReactNode[] = [];
  if (ft != null) stats.push(<Stat key="ft" value={ft} unit="%" pct={ft} label="follow-through" />);
  if (habits.length > 0) stats.push(<Stat key="streak" value={bestStreak} unit="d" pct={100} label="best habit streak" />);
  if (paced.length > 0)
    stats.push(<Stat key="pace" value={onPace} unit={`of ${paced.length}`} pct={(onPace / paced.length) * 100} label="goals on pace" />);
  stats.push(<Stat key="done" value={done14} pct={100} label="done · 14 days" />);
  if (stats.length === 0) return null;

  return (
    <div className="au-lit grid gap-6 pt-2" style={{ gridTemplateColumns: `repeat(auto-fit, minmax(130px, 1fr))` }}>
      {stats}
    </div>
  );
}

function GoalsBody() {
  const [goals, setGoals] = useState<Goal[] | null>(null);
  const [name, setName] = useState("");
  const [targetN, setTargetN] = useState("10");
  const [horizon, setHorizon] = useState("quarter");
  // A failed load must not render as "you have no goals" (final council).
  const [loadFailed, setLoadFailed] = useState(false);
  // The +1 ceremony: the row that just moved wears the land glow briefly.
  const [landed, setLanded] = useState<string | null>(null);
  // The always-open form collapses to a hairline until asked for.
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/deck");
      if (res.ok) {
        setGoals((await res.json()).goals);
        setLoadFailed(false);
      } else {
        setLoadFailed(true);
      }
    } catch {
      setLoadFailed(true);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const act = async (payload: Record<string, any>) => {
    await fetch("/api/today/actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: localDate(), ...payload }),
    });
    await load();
  };

  const bump = async (id: string) => {
    setLanded(id);
    window.setTimeout(() => setLanded((l) => (l === id ? null : l)), 650);
    await act({ action: "bumpGoal", id });
  };

  const grouped = HORIZON_ORDER.map((hz) => ({
    horizon: hz,
    items: (goals ?? []).filter((g) => g.horizon === hz),
  })).filter((g) => g.items.length > 0);

  const capsRow: React.CSSProperties = {
    fontFamily: "var(--font-body),Georgia,serif", fontWeight: 600, fontSize: 13,
    letterSpacing: ".22em", textTransform: "uppercase",
  };

  return (
    <main className="max-w-3xl mx-auto space-y-8 relative" style={{ color: "var(--ink)" }}>
      <CampaignHero />

      {loadFailed && goals === null && (
        <p className="au-kicker" style={{ display: "block", color: "var(--attn)" }}>
          Couldn&apos;t reach the brain — your goals are safe, they just can&apos;t be shown right now.
        </p>
      )}

      <Divider />

      {grouped.map((grp) => (
        <Panel key={grp.horizon} label={HORIZON_LABEL[grp.horizon] ?? grp.horizon}>
          <div className="space-y-5">
            {grp.items.map((g) => {
              const m = g.measure ?? {};
              const p = paceNote(g);
              return (
                <div key={g.id} className={landed === g.id ? "au-land" : ""} style={{ borderRadius: 2 }}>
                  <div className="flex items-center justify-between gap-3 mb-1.5">
                    <span style={{ color: "var(--ink)" }}>{g.name}</span>
                    <span className="flex items-center gap-3 shrink-0">
                      <span style={{
                        fontFamily: "var(--font-data),Arial,sans-serif", fontSize: 13,
                        color: "var(--ink3)", fontVariantNumeric: "tabular-nums", letterSpacing: ".04em",
                      }}>
                        {m.current ?? 0}/{m.target ?? 1}{m.unit ? ` ${m.unit}` : ""}
                      </span>
                      <span style={{
                        fontFamily: "var(--font-serif),Georgia,serif", fontWeight: 700,
                        color: "var(--gold)", fontVariantNumeric: "tabular-nums",
                      }}>{g.progressPct}%</span>
                      <Btn ghost onClick={() => bump(g.id)} style={{ padding: ".2rem .6rem", fontSize: 11.5 }}>+1</Btn>
                    </span>
                  </div>
                  {/* the bar — stat-base grammar at ledger height */}
                  <div style={{ height: 6, background: "var(--line1)", borderRadius: 1, overflow: "hidden" }}>
                    <div style={{
                      height: "100%", width: `${g.progressPct}%`,
                      background: "linear-gradient(90deg,var(--gold-dim),var(--gold-bright))",
                      transition: "width .5s var(--au-ease)",
                    }} />
                  </div>
                  {p && (
                    <p className="au-kicker" style={{ display: "block", marginTop: 4, fontSize: 12.5, color: p.color }}>
                      {p.text}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </Panel>
      ))}

      {/* NEW GOAL — a hairline until you reach for it; same fields, same submit */}
      {!creating ? (
        <button
          onClick={() => setCreating(true)}
          className="w-full text-left"
          style={{
            ...capsRow, background: "none", border: 0, cursor: "pointer",
            borderTop: "1px solid var(--line1)", borderBottom: "1px solid var(--line1)",
            padding: ".7rem .25rem", color: "var(--ink3)",
          }}
        >
          + new goal
        </button>
      ) : (
        <Panel tier="card" label="New Goal"
          headerRight={<button className="au-undo" onClick={() => setCreating(false)}>close</button>}>
          <div className="flex flex-wrap gap-2">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="What are you after?"
              className="flex-1 min-w-[200px] bg-black/40 border border-aurelius-gold/25 rounded-[2px] px-3 py-2 text-sm" />
            <input value={targetN} onChange={(e) => setTargetN(e.target.value)} placeholder="target"
              className="w-20 bg-black/40 border border-aurelius-gold/25 rounded-[2px] px-2 py-2 text-sm text-center" />
            <select value={horizon} onChange={(e) => setHorizon(e.target.value)}
              className="bg-black/40 border border-aurelius-gold/25 rounded-[2px] px-2 py-2 text-sm text-neutral-300">
              <option value="quarter">quarter</option>
              <option value="year">year</option>
              <option value="life">life</option>
            </select>
            <Btn onClick={() => { if (name.trim()) { act({ action: "createGoal", name: name.trim(), target: Number(targetN) || 1, horizon }); setName(""); } }}>
              Add
            </Btn>
          </div>
        </Panel>
      )}
    </main>
  );
}

const TABS = [
  { key: "goals", label: "Goals" },
  { key: "projects", label: "Projects" },
  { key: "scoreboard", label: "Scoreboard" },
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

function GoalsInner() {
  const [tab, setTab] = useState<TabKey>("goals");

  // Keyed on the live search params (not mount-once): a ⌘K jump to ?tab=…
  // while ALREADY on this page must switch tabs (same-route nav ≠ remount).
  const searchParams = useSearchParams();
  useEffect(() => {
    const t = searchParams.get("tab");
    if (t && TABS.some((x) => x.key === t)) setTab(t as TabKey);
  }, [searchParams]);

  return (
    <div className="au-horizon space-y-6 pb-16">
      <header className="text-center pt-2 relative">
        <h1 className="au-title" style={{ fontSize: "clamp(2rem,5vw,2.6rem)", lineHeight: 1.1, margin: 0 }}>
          The Campaign
        </h1>
        <p className="au-kicker" style={{ display: "block", marginTop: ".5rem", fontSize: "1.05rem", color: "var(--ink2)" }}>
          the numbers that must move — and whether you moved them
        </p>
      </header>
      <nav className="flex justify-center gap-2 max-w-3xl mx-auto relative">
        {TABS.map((t) => (
          <TabChip key={t.key} on={tab === t.key} onClick={() => setTab(t.key)}>{t.label}</TabChip>
        ))}
      </nav>
      {tab === "goals" && <GoalsBody />}
      {tab === "projects" && (
        <main className="max-w-3xl mx-auto relative" style={{ color: "var(--ink)" }}>
          <ProjectsSection />
        </main>
      )}
      {tab === "scoreboard" && <ScoreboardPanel />}
    </div>
  );
}

export default function GoalsPage() {
  return (
    <Suspense fallback={null}>
      <GoalsInner />
    </Suspense>
  );
}
