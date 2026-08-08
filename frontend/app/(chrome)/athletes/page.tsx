"use client";

// ATHLETES — the coaching surface: the roster of everyone Cole coaches, each
// athlete's numbers, and their trends (REDESIGN_PLAN.md).
//
// The roster comes from /api/athletes (backed by crm/performance.athleteRoster
// — BOTH kinds: paying clients and training-only athletes, each badged, each
// carrying a trend summary). The QUICK-LOG BAR up top is the page's primary
// action for gym use — pick an athlete, type the number, done; it POSTs the
// same retention kind:"metric" write as everything else, PR detection
// included. The roster sorts (recent · trending · PRs · name) and filters
// (all · clients · training) client-side. Selecting a row expands the
// performance view in place (/api/athletes/[id]): per-metric sparkline
// trends, the radar, and the PR ledger — with a second log form in context.
// Promotion (training_only → client) is the ONE door into the business
// machinery, behind a two-step confirm; there is deliberately no demote.
//
// Honesty rules this page: an empty roster says so — never sample athletes,
// never rendered zeroes dressed as progress. An athlete with no measure at
// 2+ points has NO trend chip (null is a fact, not a zero). Radar axes are
// normalized against THAT athlete's own history (latest vs his min/max) —
// his shape over time, and the page says so. Sparklines draw raw values (a
// dropping 40 time slopes down); trend chips carry direction honestly
// (positive always = better, even for sprint times — the server orients).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Panel, Btn, Divider, LedgerRow, SectionLabel, day } from "../../../components/kit";
import AthleteRadar, { type RadarAxis } from "../../../components/kit/AthleteRadar";

/* ── types (JSON shapes of crm/performance — dates arrive as ISO strings) ── */

type TrendSummary = {
  improving: number;
  declining: number;
  flat: number;
  avgPct: number; // orientation-corrected: positive ALWAYS means got better
};

type RosterRow = {
  id: string;
  name: string;
  kind: string; // "client" | "training_only"
  status: string;
  sport: string | null;
  position: string | null;
  gradYear: number | null;
  lastLoggedAt: string | null;
  prCount: number;
  metricCount: number;
  trend: TrendSummary | null; // null = no measure has 2+ points yet — a fact, not a zero
};

type SeriesPoint = { value: number; isPR: boolean; achievedAt: string };

type Series = {
  label: string;
  unit: string | null;
  lowerIsBetter: boolean;
  count: number;
  latest: { value: number; achievedAt: string };
  best: { value: number; achievedAt: string };
  first: { value: number; achievedAt: string };
  improvementPct: number | null; // signed; POSITIVE always means improved
  prCount: number;
  points: SeriesPoint[];
};

type Detail = {
  id: string;
  name: string;
  kind: string;
  status: string;
  sport: string | null;
  position: string | null;
  gradYear: number | null;
  isMinor: boolean;
  notes: string | null;
  lastLoggedAt: string | null;
  prCount: number;
  series: Series[]; // most-recently-trained first (server-sorted)
  recentPRs: Array<{ label: string; value: number; unit: string | null; achievedAt: string }>;
};

/* ── small helpers ── */

const fmtNum = (value: number) =>
  Number.isInteger(value) ? String(value) : String(Math.round(value * 100) / 100);
const fmt = (value: number, unit: string | null) => `${fmtNum(value)}${unit ?? ""}`;

function ago(iso: string | null): string {
  if (!iso) return "never";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400_000);
  if (days <= 0) return "today";
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

const DATA_FONT: React.CSSProperties = { fontFamily: "var(--font-data),Arial,sans-serif" };
const SERIF_FONT: React.CSSProperties = { fontFamily: "var(--font-serif),Georgia,serif" };
const BODY_FONT: React.CSSProperties = { fontFamily: "var(--font-body),Georgia,serif" };

const field =
  "bg-black/50 border border-aurelius-gold/30 rounded-[2px] px-2 py-1.5 text-sm text-aurelius-text placeholder:text-aurelius-text/30";

/* ── kind badge: gold CLIENT tick-label vs neutral stone TRAINING.
      A paused/ended athlete wears it dimmed — the roster meta line carries
      the status word itself. ── */
function KindBadge({ kind, status }: { kind: string; status?: string }) {
  const client = kind === "client";
  const dimmed = status != null && status !== "active";
  return (
    <span
      style={{
        ...DATA_FONT,
        fontSize: 10,
        letterSpacing: ".22em",
        padding: "2px 7px",
        borderRadius: 2,
        flex: "none",
        border: `1px solid ${client ? "var(--gold-line)" : "var(--line2)"}`,
        color: client ? "var(--gold)" : "var(--ink3)",
        background: client ? "rgba(212,175,55,.08)" : "none",
        opacity: dimmed ? 0.5 : 1,
      }}
    >
      {client ? "CLIENT" : "TRAINING"}
    </span>
  );
}

/* ── improvement chip: positive = money green ▲, negative = terracotta ▼.
      improvementPct is already oriented (a faster 40 arrives positive). ── */
function TrendChip({ pct }: { pct: number | null }) {
  if (pct == null) return null;
  const flat = pct === 0;
  const color = flat ? "var(--ink3)" : pct > 0 ? "var(--money)" : "var(--danger)";
  return (
    <span
      style={{
        ...DATA_FONT,
        fontSize: 11,
        letterSpacing: ".05em",
        fontVariantNumeric: "tabular-nums",
        color,
        border: "1px solid var(--line2)",
        borderRadius: 2,
        padding: "1px 6px",
        flex: "none",
      }}
    >
      {flat ? "0%" : `${pct > 0 ? "▲" : "▼"} ${Math.abs(pct)}%`}
    </span>
  );
}

/* ── PR flash — the live region stays mounted (initially empty) so screen
      readers announce the text CHANGE; only the styling flips. Shared by the
      quick-log bar and the detail-panel form. ── */
function PrFlash({ on }: { on: boolean }) {
  return (
    <span
      aria-live="polite"
      className={on ? "au-land au-shimmer" : undefined}
      style={
        on
          ? {
              ...SERIF_FONT,
              fontWeight: 700,
              fontSize: 14,
              letterSpacing: ".3em",
              color: "var(--gold)",
              border: "1px solid var(--gold-line)",
              borderRadius: 2,
              padding: "2px 8px",
            }
          : { position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap" }
      }
    >
      {on ? "PR" : ""}
    </span>
  );
}

/* ── small engraved chip-button: the sort/filter control grammar ── */
function ChipBtn({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      style={{
        ...BODY_FONT, fontWeight: 600, fontSize: 11.5, letterSpacing: ".16em", textTransform: "uppercase",
        padding: ".3rem .7rem", borderRadius: 2, cursor: "pointer",
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

/* ── inline sparkline: raw values over time (never inverted — the chip
      carries direction), gold-dim 1px, PR dots, final point emphasized ── */
function Sparkline({ points }: { points: SeriesPoint[] }) {
  const W = 120, H = 36, PAD = 4;
  const ts = points.map((p) => new Date(p.achievedAt).getTime());
  const vs = points.map((p) => p.value);
  const t0 = Math.min(...ts), t1 = Math.max(...ts);
  const v0 = Math.min(...vs), v1 = Math.max(...vs);
  const x = (t: number) => (t1 === t0 ? W / 2 : PAD + ((t - t0) / (t1 - t0)) * (W - PAD * 2));
  const y = (v: number) => (v1 === v0 ? H / 2 : H - PAD - ((v - v0) / (v1 - v0)) * (H - PAD * 2));
  const d = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(ts[i]).toFixed(1)} ${y(p.value).toFixed(1)}`).join(" ");
  const li = points.length - 1;
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true" style={{ flex: "none" }}>
      <path d={d} fill="none" stroke="var(--gold-dim)" strokeWidth={1} strokeLinejoin="round" strokeLinecap="round" />
      {points.map((p, i) =>
        p.isPR && i < li ? <circle key={i} cx={x(ts[i])} cy={y(p.value)} r={1.7} fill="var(--gold)" /> : null
      )}
      <circle cx={x(ts[li])} cy={y(points[li].value)} r={2.6} fill={points[li].isPR ? "var(--gold-bright)" : "var(--gold)"} />
    </svg>
  );
}

/* ── radar feed: same gates as ever — ≤8 axes, each label's latest value
      positioned against THAT athlete's own min/max history, banded 60..130,
      single point mid-band at 95 (a baseline, not a judgment). Direction now
      comes from the server's lowerIsBetter, not a client-side regex. ── */
const MAX_AXES = 8;

function deriveAxes(series: Series[]): { axes: RadarAxis[]; priorR?: number[] } {
  const position = (s: Series, value: number): number => {
    const values = s.points.map((p) => p.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    if (max === min) return 95;
    const frac = s.lowerIsBetter ? (max - value) / (max - min) : (value - min) / (max - min);
    return 60 + 70 * frac;
  };
  // series arrives most-recently-trained first; keep the top 8, then a fixed
  // alphabetical axis order so the shape doesn't rotate between visits.
  const picked = [...series].slice(0, MAX_AXES).sort((a, b) => a.label.localeCompare(b.label));
  const axes: RadarAxis[] = picked.map((s) => ({
    label: s.label,
    display: fmt(s.latest.value, s.unit),
    r: position(s, s.latest.value),
    pr: s.points[s.points.length - 1]?.isPR ?? false,
  }));
  const anyPrior = picked.some((s) => s.points.length > 1);
  const priorR = anyPrior
    ? picked.map((s) => position(s, s.points.length > 1 ? s.points[s.points.length - 2].value : s.latest.value))
    : undefined;
  return { axes, priorR };
}

/* ═══════════════════════════ the page ═══════════════════════════ */

const SORT_OPTIONS = [
  { key: "recent", label: "Recent" },
  { key: "trending", label: "Trending" },
  { key: "prs", label: "PRs" },
  { key: "name", label: "Name" },
] as const;
type SortKey = (typeof SORT_OPTIONS)[number]["key"];

const FILTER_OPTIONS = [
  { key: "all", label: "All" },
  { key: "client", label: "Clients" },
  { key: "training_only", label: "Training" },
] as const;
type FilterKey = (typeof FILTER_OPTIONS)[number]["key"];

export default function AthletesPage() {
  const [athletes, setAthletes] = useState<RosterRow[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  // Save succeeded but the roster re-read didn't — say so, never silently.
  const [staleNote, setStaleNote] = useState<string | null>(null);
  // The id of the detail fetch currently in flight / most recently requested.
  // A response (data OR error) from an older request is dropped, so rapid
  // athlete-switching can never wedge the panel or paint the wrong error.
  const detailReqRef = useRef<string | null>(null);

  const loadRoster = useCallback(async (): Promise<RosterRow[]> => {
    const res = await fetch("/api/athletes");
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error ?? "Failed to load athletes");
    setAthletes(data.athletes);
    return data.athletes as RosterRow[];
  }, []);

  const loadDetail = useCallback(async (clientId: string) => {
    detailReqRef.current = clientId;
    setDetailError(null);
    try {
      const res = await fetch(`/api/athletes/${encodeURIComponent(clientId)}`);
      const data = await res.json();
      if (detailReqRef.current !== clientId) return; // stale — a newer request owns the panel
      if (!res.ok) throw new Error(data?.error ?? "Failed to load the athlete");
      setDetail(data);
    } catch (e: any) {
      if (detailReqRef.current !== clientId) return;
      setDetail(null);
      setDetailError(e?.message ?? "Failed to load the athlete");
    }
  }, []);

  useEffect(() => {
    loadRoster().catch(() => setLoadFailed(true));
  }, [loadRoster]);

  useEffect(() => {
    setDetail(null);
    if (selectedId) loadDetail(selectedId);
    else detailReqRef.current = null;
  }, [selectedId, loadDetail]);

  // Sort + filter are view state only — the roster itself is never mutated.
  const [sortKey, setSortKey] = useState<SortKey>("recent");
  const [filterKey, setFilterKey] = useState<FilterKey>("all");

  // The current view: filtered by kind, then sorted. "Recent" is the default
  // (last-logged desc, never-logged last); "Trending" puts null-trend rows
  // last — no trend is a fact, not a bad score.
  const view = useMemo(() => {
    if (!athletes) return null;
    const t = (a: RosterRow) => (a.lastLoggedAt ? new Date(a.lastLoggedAt).getTime() : -1);
    const byRecent = (a: RosterRow, b: RosterRow) => t(b) - t(a) || a.name.localeCompare(b.name);
    const arr = filterKey === "all" ? [...athletes] : athletes.filter((a) => a.kind === filterKey);
    switch (sortKey) {
      case "trending":
        arr.sort((a, b) => {
          if (a.trend == null && b.trend == null) return byRecent(a, b);
          if (a.trend == null) return 1;
          if (b.trend == null) return -1;
          return b.trend.avgPct - a.trend.avgPct || byRecent(a, b);
        });
        break;
      case "prs":
        arr.sort((a, b) => b.prCount - a.prCount || byRecent(a, b));
        break;
      case "name":
        arr.sort((a, b) => a.name.localeCompare(b.name));
        break;
      default:
        arr.sort(byRecent);
    }
    return arr;
  }, [athletes, sortKey, filterKey]);

  const refreshAll = useCallback(async () => {
    await Promise.all([
      loadRoster()
        .then(() => setStaleNote(null))
        // The write landed; only the re-read failed — say so instead of silence.
        .catch(() => setStaleNote("saved — roster view may be stale, refresh to be sure")),
      selectedId ? loadDetail(selectedId) : Promise.resolve(),
    ]);
  }, [loadRoster, loadDetail, selectedId]);

  // After a quick-log: refresh the roster, and the detail panel only if the
  // logged athlete is the one currently expanded.
  const refreshAfterLog = useCallback(async (clientId: string) => {
    await Promise.all([
      loadRoster()
        .then(() => setStaleNote(null))
        .catch(() => setStaleNote("saved — roster view may be stale, refresh to be sure")),
      selectedId === clientId ? loadDetail(clientId) : Promise.resolve(),
    ]);
  }, [loadRoster, loadDetail, selectedId]);

  if (loadFailed) {
    return (
      <div className="au-horizon">
        <div className="p-6 max-w-6xl mx-auto">
          <h1 className="au-title" style={{ fontSize: "clamp(2rem,5vw,2.6rem)", lineHeight: 1.1 }}>Athletes</h1>
          <div className="rounded-[2px] border border-red-500/40 bg-red-950/20 p-4 text-sm text-red-200 mt-4">
            Couldn&apos;t load the roster. This is a loading failure, not an empty roster — your data is fine.
            <button
              onClick={() => { setLoadFailed(false); loadRoster().catch(() => setLoadFailed(true)); }}
              className="ml-3 underline hover:text-red-100"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="au-horizon">
      <div className="p-6 max-w-3xl mx-auto pb-24 relative">
        <div className="aurelius-reveal space-y-8">
          <header className="text-center">
            <h1 className="au-title" style={{ fontSize: "clamp(2rem,5vw,2.6rem)", lineHeight: 1.1, margin: 0 }}>
              Athletes
            </h1>
            <p className="au-kicker" style={{ display: "block", marginTop: ".5rem", fontSize: "1.05rem", color: "var(--ink2)" }}>
              Everyone you coach — the numbers, and which way they&apos;re moving.
            </p>
          </header>

          {view == null || athletes == null ? (
            <p className="au-kicker" style={{ display: "block", textAlign: "center" }}>reading the roster…</p>
          ) : athletes.length === 0 ? (
            /* ── the honest empty: no athletes, no theatre ── */
            <div className="text-center space-y-6">
              <div className="flex justify-center mt-2">
                <AthleteRadar axes={[]} />
              </div>
              <p className="au-kicker" style={{ display: "block" }}>
                No athletes on the roster yet
              </p>
              <AddAthleteForm startOpen onAdded={refreshAll} />
            </div>
          ) : (
            <>
              {/* ── quick log — THE primary action for gym use ── */}
              <QuickLogBar athletes={athletes} onLogged={refreshAfterLog} />

              {staleNote && (
                <p className="au-kicker" style={{ display: "block", textAlign: "center", color: "var(--attn)" }}>
                  {staleNote}
                </p>
              )}

              {/* ── sort + filter — who's trending well, at a glance ── */}
              <div className="flex items-center justify-between gap-x-4 gap-y-2 flex-wrap">
                <div className="flex gap-1.5 flex-wrap items-center">
                  {FILTER_OPTIONS.map((f) => {
                    const count =
                      f.key === "all" ? athletes.length : athletes.filter((a) => a.kind === f.key).length;
                    return (
                      <ChipBtn key={f.key} on={filterKey === f.key} onClick={() => setFilterKey(f.key)}>
                        {f.label}{" "}
                        <span style={{ ...DATA_FONT, fontSize: 10.5, letterSpacing: ".04em", fontVariantNumeric: "tabular-nums" }}>
                          {count}
                        </span>
                      </ChipBtn>
                    );
                  })}
                </div>
                <div className="flex gap-1.5 flex-wrap items-center">
                  <span style={{ ...DATA_FONT, fontSize: 10.5, letterSpacing: ".2em", color: "var(--ink3)" }}>SORT</span>
                  {SORT_OPTIONS.map((s) => (
                    <ChipBtn key={s.key} on={sortKey === s.key} onClick={() => setSortKey(s.key)}>
                      {s.label}
                    </ChipBtn>
                  ))}
                </div>
              </div>

              {/* ── the roster ──
                    (A "You" row for Cole's OWN training — the REDESIGN_PLAN
                    roster chip — is a later phase: deferred, never faked with
                    a placeholder row here.) */}
              {view.length === 0 ? (
                /* filtered-empty is its own honest message, never the generic empty */
                <p className="au-kicker" style={{ display: "block", textAlign: "center" }}>
                  {filterKey === "client"
                    ? "no clients on the roster yet — promote a training athlete or add one"
                    : "no training-only athletes yet"}
                </p>
              ) : (
              <div className="space-y-3">
                {view.map((a) => (
                  <div key={a.id}>
                    <button
                      onClick={() => setSelectedId((cur) => (cur === a.id ? null : a.id))}
                      aria-expanded={selectedId === a.id}
                      className="au-card w-full text-left p-4"
                      style={{ cursor: "pointer" }}
                    >
                      <div className="flex items-center justify-between gap-x-5 gap-y-2 flex-wrap">
                        <div className="min-w-0">
                          <span className="flex items-center gap-2.5 flex-wrap">
                            <span style={{ ...BODY_FONT, fontWeight: 600, fontSize: "1.2rem", color: "var(--ink)" }}>
                              {a.name}
                            </span>
                            <KindBadge kind={a.kind} status={a.status} />
                          </span>
                          <span style={{ ...DATA_FONT, fontSize: 12, letterSpacing: ".06em", color: "var(--ink3)" }}>
                            {[
                              a.sport,
                              a.position,
                              a.gradYear != null ? `'${String(a.gradYear).slice(-2)}` : null,
                              a.status !== "active" ? a.status : null,
                            ]
                              .filter(Boolean)
                              .join(" · ") || "—"}
                          </span>
                        </div>
                        <div className="flex items-baseline gap-5 flex-none">
                          {/* trend: server-oriented avgPct — absent entirely
                              when no measure has 2+ points (never a fake 0) */}
                          {a.trend && (
                            <span className="flex items-center gap-1.5 flex-none">
                              <TrendChip pct={a.trend.avgPct} />
                              {a.trend.improving > 0 && a.trend.declining > 0 && (
                                <span style={{ ...DATA_FONT, fontSize: 10.5, color: "var(--ink3)", fontVariantNumeric: "tabular-nums", letterSpacing: ".04em" }}>
                                  {a.trend.improving}▲ {a.trend.declining}▼
                                </span>
                              )}
                            </span>
                          )}
                          <span className="text-right">
                            <span style={{ ...SERIF_FONT, fontWeight: 700, fontSize: "1.3rem", color: a.prCount > 0 ? "var(--gold)" : "var(--ink3)", fontVariantNumeric: "tabular-nums" }}>
                              {a.prCount}
                            </span>
                            <span style={{ ...DATA_FONT, fontSize: 10.5, letterSpacing: ".18em", color: "var(--ink3)", marginLeft: 5 }}>
                              PR{a.prCount === 1 ? "" : "S"}
                            </span>
                          </span>
                          <span style={{ ...DATA_FONT, fontSize: 12, color: "var(--ink3)", fontVariantNumeric: "tabular-nums" }}>
                            {a.metricCount} logged
                          </span>
                          <span style={{ ...DATA_FONT, fontSize: 12, color: a.lastLoggedAt ? "var(--ink2)" : "var(--ink3)" }}>
                            {ago(a.lastLoggedAt)}
                          </span>
                        </div>
                      </div>
                    </button>

                    {/* ── the expanded performance view, in place ── */}
                    {selectedId === a.id && (
                      <div className="mt-3">
                        {detailError ? (
                          <div className="rounded-[2px] border border-red-500/40 bg-red-950/20 p-4 text-sm text-red-200">
                            {detailError}
                            <button onClick={() => loadDetail(a.id)} className="ml-3 underline hover:text-red-100">Retry</button>
                          </div>
                        ) : detail == null || detail.id !== a.id ? (
                          <p className="au-kicker" style={{ display: "block", textAlign: "center" }}>reading the ledger…</p>
                        ) : (
                          <AthleteDetail key={a.id} detail={detail} onChanged={refreshAll} />
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              )}

              <Divider />

              <AddAthleteForm onAdded={refreshAll} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═════════════════════ the expanded athlete ═════════════════════ */

const INITIAL_SERIES = 6;

function AthleteDetail({ detail, onChanged }: { detail: Detail; onChanged: () => Promise<void> }) {
  const [showAll, setShowAll] = useState(false);
  const { axes, priorR } = useMemo(() => deriveAxes(detail.series), [detail.series]);
  const visible = showAll ? detail.series : detail.series.slice(0, INITIAL_SERIES);
  const centerWord =
    detail.prCount > 0 ? `${detail.prCount} PR${detail.prCount === 1 ? "" : "S"}` : detail.sport ?? undefined;

  return (
    /* the one glass tablet on this page — the athlete under the lens */
    <Panel tier="glass">
      {/* ── header ── */}
      <div className="flex items-baseline justify-between gap-x-5 gap-y-2 flex-wrap">
        <span className="flex items-center gap-2.5 flex-wrap">
          <span style={{ ...BODY_FONT, fontWeight: 600, fontSize: "1.45rem", color: "var(--ink)" }}>{detail.name}</span>
          <KindBadge kind={detail.kind} status={detail.status} />
        </span>
        <span className="flex items-baseline gap-4">
          <span>
            <span style={{ ...SERIF_FONT, fontWeight: 700, fontSize: "1.5rem", color: detail.prCount > 0 ? "var(--gold)" : "var(--ink3)", fontVariantNumeric: "tabular-nums" }}>
              {detail.prCount}
            </span>
            <span style={{ ...DATA_FONT, fontSize: 10.5, letterSpacing: ".18em", color: "var(--ink3)", marginLeft: 5 }}>
              PR{detail.prCount === 1 ? "" : "S"}
            </span>
          </span>
          <span style={{ ...DATA_FONT, fontSize: 12, color: "var(--ink3)" }}>last logged {ago(detail.lastLoggedAt)}</span>
        </span>
      </div>
      {(detail.sport || detail.position || detail.gradYear != null || detail.status !== "active") && (
        <p style={{ ...DATA_FONT, fontSize: 12, letterSpacing: ".06em", color: "var(--ink3)", marginTop: 4 }}>
          {[
            detail.sport,
            detail.position,
            detail.gradYear != null ? `class of ${detail.gradYear}` : null,
            detail.status !== "active" ? detail.status : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      )}

      {/* ── trends ── */}
      <div style={{ marginTop: "1.6rem" }}>
        <SectionLabel row>Trends</SectionLabel>
        {detail.series.length === 0 ? (
          <p className="au-kicker" style={{ display: "block", marginTop: ".8rem" }}>
            nothing measured yet — log the first number below
          </p>
        ) : (
          <>
            {visible.map((s) => (
              <div
                key={s.label.toLowerCase()}
                className="flex items-center gap-x-4 gap-y-1 flex-wrap"
                style={{ borderBottom: "1px solid var(--line1)", padding: ".65rem .1rem" }}
              >
                <div className="flex-1 min-w-[8.5rem]">
                  <div style={{ ...DATA_FONT, fontSize: 11.5, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--ink2)" }}>
                    {s.label}
                    {s.unit ? <span style={{ color: "var(--ink3)" }}> · {s.unit}</span> : null}
                    {s.prCount > 0 && <span style={{ color: "var(--gold-dim)" }}> ✦{s.prCount}</span>}
                  </div>
                  <div style={{ ...DATA_FONT, fontSize: 11, color: "var(--ink3)", fontVariantNumeric: "tabular-nums" }}>
                    {s.count} {s.count === 1 ? "entry" : "entries"} · best {fmt(s.best.value, s.unit)}
                  </div>
                </div>
                {s.count > 1 ? (
                  <Sparkline points={s.points} />
                ) : (
                  <span className="au-kicker" style={{ fontSize: 12.5, flex: "none" }}>first entry — baseline</span>
                )}
                <div className="flex items-center gap-2 ml-auto flex-none">
                  {/* Cinzel carries ONLY the numeral — the unit drops to a
                      Cormorant sub-span, the kit's .au-unit grammar */}
                  <span style={{ ...SERIF_FONT, fontWeight: 700, fontSize: "1.15rem", color: "var(--ink)", fontVariantNumeric: "tabular-nums" }}>
                    {fmtNum(s.latest.value)}
                    {s.unit ? (
                      <span style={{ ...BODY_FONT, fontWeight: 600, fontSize: ".6em", letterSpacing: ".06em", color: "var(--ink2)", marginLeft: 2 }}>
                        {s.unit}
                      </span>
                    ) : null}
                  </span>
                  <TrendChip pct={s.improvementPct} />
                </div>
              </div>
            ))}
            {detail.series.length > INITIAL_SERIES && !showAll && (
              <button
                onClick={() => setShowAll(true)}
                className="au-undo"
                style={{ marginTop: ".7rem", marginLeft: 0 }}
              >
                show all {detail.series.length}
              </button>
            )}
          </>
        )}
      </div>

      {/* ── the instrument ── */}
      <div style={{ marginTop: "1.8rem" }} className="text-center">
        <div className="flex justify-center">
          <AthleteRadar key={detail.id} axes={axes} priorR={priorR} centerWord={centerWord} />
        </div>
        <p className="au-kicker" style={{ display: "block", marginTop: ".6rem", fontSize: 13.5 }}>
          {axes.length >= 3
            ? priorR
              ? "the dashed ghost is the prior entry per lift — the gold line is now, against his own range"
              : "positioned against his own history — more entries per lift will draw the ghost"
            : axes.length === 2
              ? "two measures — a pair of gauges, not a shape; a third draws the polygon"
              : axes.length === 1
                ? "one measure on record — a second different measure starts the instrument"
                : "no numbers on record yet — the first entry below starts the shape"}
        </p>
      </div>

      {/* ── the PR ledger ── */}
      <div style={{ marginTop: "1.6rem" }}>
        <SectionLabel row>Recent PRs</SectionLabel>
        {detail.recentPRs.length === 0 ? (
          <p className="au-kicker" style={{ display: "block", marginTop: ".8rem" }}>
            no personal bests on record yet — the first will be engraved here
          </p>
        ) : (
          detail.recentPRs.map((p, i) => (
            <LedgerRow
              key={`${p.label}-${p.achievedAt}-${i}`}
              tick="gold"
              verb={p.label}
              obj={<>{fmt(p.value, p.unit)} · {day(p.achievedAt)}</>}
            />
          ))
        )}
      </div>

      {/* ── log a metric — the one real write on this view ── */}
      <div style={{ marginTop: "1.6rem" }}>
        <LogMetricForm clientId={detail.id} onLogged={onChanged} />
      </div>

      {/* ── promotion: the one door into the business — no demote by design ── */}
      {detail.kind === "training_only" && (
        <div style={{ marginTop: "1.4rem", borderTop: "1px solid var(--line1)", paddingTop: "1rem" }}>
          <PromoteControl id={detail.id} name={detail.name} onPromoted={onChanged} />
        </div>
      )}
    </Panel>
  );
}

/* ═════════════════ quick log — the gym-floor write ═════════════════ */

// The fastest thing on the page: pick an athlete, type the number, done.
// Same POST as the detail-panel form (retention kind:"metric", PR detection
// included). Athlete + label + unit are STICKY after a save and only the
// value clears — both gym flows ("three lifts for one athlete", "everyone's
// 40 today") are one keystroke away from the next entry.
function QuickLogBar({ athletes, onLogged }: {
  athletes: RosterRow[];
  onLogged: (clientId: string) => Promise<void>;
}) {
  // Select is always in recency order (who you just coached is on top),
  // independent of the roster's current sort control.
  const options = useMemo(
    () =>
      [...athletes].sort((a, b) => {
        const ta = a.lastLoggedAt ? new Date(a.lastLoggedAt).getTime() : -1;
        const tb = b.lastLoggedAt ? new Date(b.lastLoggedAt).getTime() : -1;
        return tb - ta || a.name.localeCompare(b.name);
      }),
    [athletes]
  );
  const [clientId, setClientId] = useState<string>(options[0]?.id ?? "");
  useEffect(() => {
    // Keep the selection valid across roster refreshes; never point at a ghost.
    if (!options.some((o) => o.id === clientId)) setClientId(options[0]?.id ?? "");
  }, [options, clientId]);

  const [label, setLabel] = useState("");
  const [value, setValue] = useState("");
  const [unit, setUnit] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [prFlash, setPrFlash] = useState(false);

  const submit = async () => {
    const who = options.find((o) => o.id === clientId);
    const v = Number(value);
    if (!who) {
      setNote({ ok: false, text: "Pick an athlete." });
      return;
    }
    // (!value.trim() matters: Number("") is 0, which is finite)
    if (!label.trim() || !value.trim() || !Number.isFinite(v)) {
      setNote({ ok: false, text: "A metric needs a label and a number." });
      return;
    }
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch("/api/crm/retention", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, kind: "metric", label: label.trim(), value: v, unit: unit.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Could not log the metric");
      if (data.isPR) {
        setPrFlash(true);
        window.setTimeout(() => setPrFlash(false), 1400);
      }
      setNote({
        ok: true,
        text: `${who.name} — ${label.trim()} ${fmt(v, unit.trim() || null)} logged${data.isPR ? " · a personal best" : ""}`,
      });
      setValue(""); // athlete, label, unit stay for the next rep
      await onLogged(clientId);
    } catch (e: any) {
      setNote({ ok: false, text: e?.message ?? "Could not log the metric" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="au-card p-3">
      <div className="flex gap-2 flex-wrap items-center">
        <select
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          aria-label="Athlete"
          disabled={busy}
          className={`${field} min-w-[9rem]`}
        >
          {options.map((o) => (
            <option key={o.id} value={o.id}>{o.name}</option>
          ))}
        </select>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Vertical, squat, 40…"
          aria-label="Metric label"
          disabled={busy}
          className={`${field} flex-1 min-w-[9rem]`}
        />
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !busy) submit(); }}
          placeholder="Value"
          aria-label="Value"
          inputMode="decimal"
          disabled={busy}
          className={`${field} w-24`}
        />
        <input
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !busy) submit(); }}
          placeholder="in / lbs / s"
          aria-label="Unit"
          disabled={busy}
          className={`${field} w-24`}
        />
        <Btn onClick={submit} disabled={busy}>
          {busy ? "Logging…" : "Log it"}
        </Btn>
        <PrFlash on={prFlash} />
      </div>
      {note && (
        <p
          className="au-kicker"
          style={{ display: "block", marginTop: ".55rem", fontSize: 13, color: note.ok ? "var(--gold)" : "var(--danger)" }}
        >
          {note.text}
        </p>
      )}
    </div>
  );
}

/* ═════════════════════ log a metric ═════════════════════ */

function LogMetricForm({ clientId, onLogged }: { clientId: string; onLogged: () => Promise<void> }) {
  const [label, setLabel] = useState("");
  const [value, setValue] = useState("");
  const [unit, setUnit] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [prFlash, setPrFlash] = useState(false);

  const submit = async () => {
    const v = Number(value);
    // (!value.trim() matters: Number("") is 0, which is finite)
    if (!label.trim() || !value.trim() || !Number.isFinite(v)) {
      setNote({ ok: false, text: "A metric needs a label and a number." });
      return;
    }
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch("/api/crm/retention", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, kind: "metric", label: label.trim(), value: v, unit: unit.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Could not log the metric");
      setNote({ ok: true, text: data.isPR ? "logged — a personal best" : "logged" });
      if (data.isPR) {
        setPrFlash(true);
        window.setTimeout(() => setPrFlash(false), 1400);
      }
      setLabel("");
      setValue("");
      setUnit("");
      await onLogged();
    } catch (e: any) {
      setNote({ ok: false, text: e?.message ?? "Could not log the metric" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <SectionLabel row>Log a metric</SectionLabel>
      <div className="flex gap-2 flex-wrap items-center" style={{ marginTop: ".8rem" }}>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Vertical, squat, 40…"
          aria-label="Metric label"
          className={`${field} flex-1 min-w-[10rem]`}
        />
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Value"
          aria-label="Value"
          inputMode="decimal"
          className={`${field} w-24`}
        />
        <input
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
          placeholder="in / lbs / s"
          aria-label="Unit"
          className={`${field} w-24`}
        />
        <Btn onClick={submit} disabled={busy}>
          {busy ? "Logging…" : "Log it"}
        </Btn>
        <PrFlash on={prFlash} />
      </div>
      {note && (
        <p
          className="au-kicker"
          style={{ display: "block", marginTop: ".7rem", color: note.ok ? "var(--gold)" : "var(--danger)" }}
        >
          {note.text}
        </p>
      )}
      <p className="au-kicker" style={{ display: "block", marginTop: ".5rem", fontSize: 13 }}>
        times and sprints count down, lifts and jumps count up — a PR is detected, never declared
      </p>
    </div>
  );
}

/* ═════════════════════ promote (two-step, one-way) ═════════════════════ */

function PromoteControl({ id, name, onPromoted }: { id: string; name: string; onPromoted: () => Promise<void> }) {
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const confirm = async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/athletes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "promote", id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Could not promote");
      await onPromoted();
    } catch (e: any) {
      setErr(e?.message ?? "Could not promote");
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {!armed ? (
        <Btn ghost onClick={() => setArmed(true)}>Promote to client</Btn>
      ) : (
        <>
          <Btn onClick={confirm} disabled={busy}>
            {busy ? "Promoting…" : "Confirm — business machinery applies from today"}
          </Btn>
          <button className="au-undo" style={{ marginLeft: 0 }} onClick={() => setArmed(false)} disabled={busy}>
            cancel
          </button>
        </>
      )}
      <span className="au-kicker" style={{ fontSize: 12.5 }}>
        {armed ? `${name} becomes a client of the business — a one-way door` : "history carries over; a one-way door"}
      </span>
      {err && (
        <span className="au-kicker" style={{ fontSize: 12.5, color: "var(--danger)" }}>{err}</span>
      )}
    </div>
  );
}

/* ═════════════════════ add athlete (collapsed) ═════════════════════ */

const KIND_OPTIONS = [
  { kind: "training_only", label: "Training only (just record them)" },
  { kind: "client", label: "Client (my business)" },
] as const;

function AddAthleteForm({ onAdded, startOpen }: { onAdded: () => Promise<void>; startOpen?: boolean }) {
  const [open, setOpen] = useState(!!startOpen);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<string>("training_only");
  const [sport, setSport] = useState("");
  const [position, setPosition] = useState("");
  const [gradYear, setGradYear] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const capsRow: React.CSSProperties = {
    ...BODY_FONT, fontWeight: 600, fontSize: 13,
    letterSpacing: ".22em", textTransform: "uppercase",
  };

  const submit = async () => {
    if (!name.trim()) {
      setErr("An athlete needs a name.");
      return;
    }
    if (gradYear.trim() && !/^\d{4}$/.test(gradYear.trim())) {
      setErr("Grad year should be a 4-digit year.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/athletes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add",
          name: name.trim(),
          kind,
          sport: sport.trim() || undefined,
          position: position.trim() || undefined,
          gradYear: gradYear.trim() ? Number(gradYear.trim()) : undefined,
          notes: notes.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Could not add the athlete");
      setName(""); setSport(""); setPosition(""); setGradYear(""); setNotes("");
      setKind("training_only");
      if (!startOpen) setOpen(false);
      await onAdded();
    } catch (e: any) {
      setErr(e?.message ?? "Could not add the athlete");
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    /* a hairline until you reach for it — the goals page's collapsed grammar */
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full text-left"
        style={{
          ...capsRow, background: "none", border: 0, cursor: "pointer",
          borderTop: "1px solid var(--line1)", borderBottom: "1px solid var(--line1)",
          padding: ".7rem .25rem", color: "var(--ink3)",
        }}
      >
        + add athlete
      </button>
    );
  }

  return (
    <Panel
      tier="card"
      label="Add athlete"
      headerRight={!startOpen ? <button className="au-undo" onClick={() => setOpen(false)}>close</button> : undefined}
      className="text-left"
    >
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name (required)"
            aria-label="Name"
            className={`${field} flex-1 min-w-[12rem]`}
          />
        </div>
        {/* kind: two labeled doors, training-only by default — adding a gym
            athlete must never accidentally enter the business machinery.
            Plain toggle buttons (aria-pressed), not role=radio — we don't
            implement the arrow-key semantics that role would promise. */}
        <div className="flex flex-wrap gap-2">
          {KIND_OPTIONS.map((o) => {
            const on = kind === o.kind;
            return (
              <button
                key={o.kind}
                aria-pressed={on}
                onClick={() => setKind(o.kind)}
                style={{
                  ...BODY_FONT, fontWeight: 600, fontSize: 12.5, letterSpacing: ".08em",
                  padding: ".45rem .8rem", borderRadius: 2, cursor: "pointer",
                  border: `1px solid ${on ? "var(--gold-line)" : "var(--line1)"}`,
                  color: on ? "var(--gold)" : "var(--ink3)",
                  background: on ? "rgba(212,175,55,.08)" : "none",
                  transition: "color .15s, border-color .15s",
                }}
              >
                {o.label}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-2">
          <input value={sport} onChange={(e) => setSport(e.target.value)} placeholder="Sport" aria-label="Sport" className={`${field} flex-1 min-w-[8rem]`} />
          <input value={position} onChange={(e) => setPosition(e.target.value)} placeholder="Position" aria-label="Position" className={`${field} flex-1 min-w-[8rem]`} />
          <input
            value={gradYear}
            onChange={(e) => setGradYear(e.target.value)}
            placeholder="Grad year"
            aria-label="Grad year"
            inputMode="numeric"
            className={`${field} w-28`}
          />
        </div>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes"
          aria-label="Notes"
          rows={2}
          className={`${field} w-full`}
        />
        <div className="flex items-center gap-3 flex-wrap">
          <Btn onClick={submit} disabled={busy}>{busy ? "Adding…" : "Add to the roster"}</Btn>
          {err && <span className="au-kicker" style={{ fontSize: 12.5, color: "var(--danger)" }}>{err}</span>}
        </div>
      </div>
    </Panel>
  );
}
