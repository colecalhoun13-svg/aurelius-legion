"use client";

// BUSINESS — Cole's remote coaching business, end to end.
//
// Scope: this is the business Cole OWNS. He is employed at the gym, so the
// athletes he coaches in person belong to his employer and never appear here.
//
// The page is built around one refusal: it will not dress an empty pipeline
// up as progress. Cole has zero remote clients and no inbound today, so the
// empty state is the loudest thing on the screen and it names the actual
// constraint — lead generation — rather than showing four proud zeroes and a
// chart. Machinery is not achievement.
//
// ELEVATED IMPERIAL re-dress (docs/REDESIGN_PLAN.md): same panels, same
// fetches, same handlers — new surfaces (open air / stone slab / one glass
// tablet), the funnel colonnade above the kanban, and FLIP so advance/signed
// visibly travel. Re-dress, never delete.

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Panel, SectionLabel, Stat, Btn, Divider, useFlip, money, day } from "../../../components/kit";

type Snapshot = {
  empty: boolean;
  headline: string;
  pipeline: Record<string, number>;
  openLeads: number;
  activeClients: number;
  engagementsByShape: { monthly: number; block: number; program: number };
  mrr: string;
  mrrCents?: number;
  receivedThisMonth: string;
  receivedThisMonthCents?: number;
  receivedAllTime: string;
  receivedAllTimeCents?: number;
  outstanding: string;
  outstandingCents: number;
  overdueCount: number;
};

type Attention = {
  blocksEnding: { engagementId: string; client: string; title: string; endsAt: string; why: string }[];
  renewalsDue: { engagementId: string; client: string; title: string; nextBillingAt: string; amount: string }[];
  followUpsOverdue: { leadId: string; name: string; action: string | null; dueAt: string; status: string }[];
  unpaid: { id: string; client: string; outstandingCents: number; overdue: boolean; description: string | null }[];
};

type Lead = {
  id: string; name: string; status: string; source: string; sport: string | null;
  nextAction: string | null; nextActionAt: string | null; referredBy: string | null;
  lastContactAt: string | null;
};

type Client = {
  id: string; name: string; status: string; sport: string | null;
  engagements: { id: string; shape: string; title: string; priceCents: number }[];
};

type Marketing = {
  totalUses: number;
  headline: string;
  angles: {
    id: string; title: string; audience: string; grounding: string; timesUsed: number;
    replies: number; leads: number; verdict: string; status: string;
    sources: { title?: string; url?: string; source?: string }[];
  }[];
};

type Offer = {
  id: string; name: string; audience: string; promise: string; shape: string;
  format: string | null; proof: string | null; edge: string | null; assumptions: string | null;
  priceCents: number | null; durationWeeks: number | null; status: string; grounding: string;
};

type OfferState = { hasActive: boolean; activeCount: number; draftCount: number; headline: string; blocker: string | null };

type ContentDraft = {
  id: string; channel: string; format: string | null; title: string | null; body: string;
  status: string; grounding: string; imageUrl: string | null; permalink: string | null;
  angle: { title: string } | null;
};

type ContentState = { draft: number; ready: number; staged: number; published: number; headline: string };

type MoneyLedger = {
  earnedCents: number; earned: string; earnedThisMonth: string; paymentCount: number;
  byChannel: { channel: string; cents: number; label: string }[];
  byAngle: { angle: string; cents: number; label: string }[];
  recordedBy: { by: string; cents: number; count: number }[];
  selfRecordedCents: number; headline: string;
};

type ExpenseSummary = {
  month: string; count: number; spentCents: number; spent: string;
  byCategory: { category: string; cents: number; label: string }[];
  quarterEstimateNote: string;
};
type ProfitAndLoss = {
  month: string;
  netThisMonthCents: number; netThisMonth: string;
  earnedThisMonth: string; spentThisMonth: string;
  headline: string;
};

type Cadence = { lastPublishedAt: string | null; daysSince: number | null; plannedThisWeek: number; line: string };

type ProbeVariant = { offerId: string; name: string; shape: string; status: string; code: string; clicks: number; leads: number };
type Probe = {
  running: boolean; variants: ProbeVariant[];
  leader: { offerId: string; name: string; leads: number } | null; note: string;
};

type TrackLink = {
  id: string; code: string; channel: string; label: string | null; clickCount: number;
  _count: { leads: number; events: number };
};

type ChannelStat = {
  channel: string; clicks: number; leads: number; replies: number;
  earnedCents: number; conversionPct: number | null; ranked: boolean;
};
type Analyst = { truth: string; ranked: ChannelStat[]; tooEarly: ChannelStat[]; hasData: boolean };

const STAGES = ["new", "contacted", "conversing", "proposed"] as const;
const SOURCES = ["manual", "referral", "instagram", "email", "word_of_mouth", "website", "other"] as const;

/* ── the momentum heat of a lead: how long since anyone touched them ── */
const daysSince = (iso: string | null) =>
  iso == null ? null : Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000));
const dotHeat = (iso: string | null) => {
  const d = daysSince(iso);
  if (d == null) return "au-dot-never";
  if (d <= 2) return "";
  if (d <= 14) return "au-dot-cool";
  return "au-dot-cold";
};
const heatBorder = (iso: string | null) => {
  const d = daysSince(iso);
  if (d == null) return "var(--gold-dim)";
  if (d <= 2) return "var(--gold)";
  if (d <= 14) return "rgba(212,175,55,.5)";
  return "#5a5a52";
};
const ageLabel = (iso: string | null) => {
  const d = daysSince(iso);
  return d == null ? "never" : `${d}d`;
};

const roman = (n: number) => {
  if (n <= 0) return "0";
  const table: [number, string][] = [
    [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"],
    [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
  ];
  let out = "";
  let v = n;
  for (const [k, s] of table) while (v >= k) { out += s; v -= k; }
  return out;
};

const serifFont = { fontFamily: "var(--font-serif),Georgia,serif" } as const;
const bodyFont = { fontFamily: "var(--font-body),Georgia,serif" } as const;
const dataFont = { fontFamily: "var(--font-data),Arial,sans-serif" } as const;

export default function BusinessPage() {
  const [data, setData] = useState<{
    pipeline: Snapshot; attention: Attention; clients: Client[]; leads: Lead[];
    marketing?: Marketing; offers?: Offer[]; offerState?: OfferState;
    drafts?: ContentDraft[]; contentState?: ContentState;
    ledger?: MoneyLedger; probe?: Probe; trackLinks?: TrackLink[]; analyst?: Analyst;
  } | null>(null);
  // A failed load must never render as "you have no business" — that reads
  // identically to the real empty state and would be a lie about his data.
  const [loadFailed, setLoadFailed] = useState(false);
  // The spend side of the treasury (what this month COST). Loaded separately
  // and tolerant of failure — a missing chip must never read as "no business".
  const [expenses, setExpenses] = useState<ExpenseSummary | null>(null);
  // The month's net (earned − spent). Additive and failure-tolerant like the
  // spend chip — its absence is a missing line, never a broken page.
  const [pnl, setPnl] = useState<ProfitAndLoss | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Transient success line — so an action that writes a Gmail draft / converts a
  // lead confirms it happened instead of succeeding silently (council UX).
  const [notice, setNotice] = useState<string | null>(null);
  // Baselines/segments light after first paint so the gold draws itself in.
  const [lit, setLit] = useState(false);

  const [openClient, setOpenClient] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [sport, setSport] = useState("");
  const [source, setSource] = useState<string>("referral");
  const [referredBy, setReferredBy] = useState("");
  const [nextAction, setNextAction] = useState("");

  // THE MOVING PIPELINE — kanban cards carry data-flip-id; capture() runs in
  // the same tick as setData so advance/signed visibly travel between columns.
  const capture = useFlip([data]);
  const captureRef = useRef(capture);
  captureRef.current = capture;

  const load = useCallback(async (animate = false) => {
    try {
      const res = await fetch("/api/crm");
      if (!res.ok) return setLoadFailed(true);
      const json = await res.json();
      if (animate) captureRef.current();
      setData(json);
      setLoadFailed(false);
    } catch {
      setLoadFailed(true);
    }
    // Spent-this-month, best-effort: the honest negative belongs on screen,
    // but its loading failure is a missing chip, never a broken page.
    try {
      const eres = await fetch("/api/crm/money");
      if (eres.ok) {
        const ej = await eres.json();
        setExpenses(ej?.expenses ?? null);
        setPnl(ej?.pnl ?? null);
      }
    } catch { /* the chip is additive */ }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (data && !lit) {
      const t = setTimeout(() => setLit(true), 120);
      return () => clearTimeout(t);
    }
  }, [data, lit]);

  async function addLead(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/crm/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          sport: sport.trim() || undefined,
          source,
          referredBy: referredBy.trim() || undefined,
          nextAction: nextAction.trim() || undefined,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? "Failed to add");
      setName(""); setSport(""); setReferredBy(""); setNextAction("");
      await load();
    } catch (err: any) {
      setError(err?.message ?? String(err));
    } finally {
      setBusy(false);
    }
  }

  async function moveLead(id: string, status: string) {
    setBusy(true);
    setError(null);
    try {
      // Was fire-and-forget: a failed PATCH left the card in place with no word,
      // so "advance"/"lost" read as dead taps (council a11y). Surface the error.
      const res = await fetch("/api/crm/leads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status, lastContactAt: new Date().toISOString() }),
      });
      if (!res.ok) throw new Error((await res.json())?.error ?? "Couldn't move that lead");
      await load(true);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally { setBusy(false); }
  }

  async function convert(id: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/crm/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "convert", id }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? "Failed to convert");
      await load(true);
      setNotice("Signed — they're in the Roster below. Add what they bought (engagement) to start the money.");
    } catch (err: any) {
      setError(err?.message ?? String(err));
    } finally { setBusy(false); }
  }

  if (loadFailed) {
    return (
      <div className="au-horizon">
        <div className="p-6 max-w-6xl mx-auto">
          <h1 className="au-title" style={{ fontSize: "clamp(2rem,5vw,2.6rem)", lineHeight: 1.1 }}>Business</h1>
          <div className="rounded-[2px] border border-red-500/40 bg-red-950/20 p-4 text-sm text-red-200 mt-4">
            Couldn&apos;t load the business. This is a loading failure, not an empty pipeline — your data is fine.
            <button onClick={() => load()} className="ml-3 underline hover:text-red-100">Retry</button>
          </div>
        </div>
      </div>
    );
  }

  if (!data) return <div className="p-6 text-aurelius-text/50">Loading…</div>;

  const { pipeline: snap, attention, clients, leads, marketing, offers, offerState, drafts, contentState, ledger, probe, trackLinks, analyst } = data;
  const openLeads = leads.filter((l) => !["won", "lost"].includes(l.status));
  const attentionCount =
    attention.blocksEnding.length + attention.renewalsDue.length + attention.followUpsOverdue.length + attention.unpaid.length;

  // THE TREASURY — committed hollow outline, received emerald, outstanding
  // amber stripes, all against the snapshot's real cents. Extent is the wider
  // of committed vs. what's actually moving, so nothing is ever clipped.
  const committedCents = snap.mrrCents ?? 0;
  const receivedCents = snap.receivedThisMonthCents ?? 0;
  const treExtent = Math.max(committedCents, receivedCents + snap.outstandingCents, 1);
  const treRecvPct = (receivedCents / treExtent) * 100;
  const treOutPct = (snap.outstandingCents / treExtent) * 100;

  return (
    <div className="au-horizon">
      <div className="p-6 max-w-6xl mx-auto pb-24 relative">
      <header className="mb-5 text-center">
        <h1 className="au-title" style={{ fontSize: "clamp(2rem,5vw,2.6rem)", lineHeight: 1.1, margin: 0 }}>
          Business
        </h1>
        <p className="au-kicker" style={{ display: "block", marginTop: ".5rem", fontSize: "1.05rem", color: "var(--ink2)" }}>
          Aurelius runs it through the night — you rule on what leaves.
        </p>
        <p className="au-kicker" style={{ display: "block", marginTop: ".7rem", fontSize: 13.5, maxWidth: "44rem", marginLeft: "auto", marginRight: "auto" }}>
          The remote coaching business you own. Athletes at the gym aren&apos;t here — those are your employer&apos;s.
        </p>
        <p className="au-kicker" style={{ display: "block", marginTop: ".35rem", fontSize: 13.5, maxWidth: "44rem", marginLeft: "auto", marginRight: "auto", lineHeight: 1.6 }}>
          Aurelius works this on its own — drafts outreach overnight, sweeps follow-ups &amp; renewals daily, records
          money as it lands. You&apos;re here to review and approve, not to do data entry. What needs you is up top.
        </p>
        {/* The front door, from the inside. /start is public and outside the
            app lock — this is how Cole finds it, checks what a stranger sees,
            and grabs the link to put anywhere. */}
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-2">
          <a href="/start" target="_blank" rel="noreferrer" className="text-[11px] text-aurelius-gold/70 hover:text-aurelius-gold inline-block">
            your front door (/start) — where prospects land →
          </a>
          <a href="/standard" target="_blank" rel="noreferrer" className="text-[11px] text-aurelius-gold/70 hover:text-aurelius-gold inline-block">
            the assessment (/standard) — the lead magnet →
          </a>
        </div>
      </header>

      {/* Sticky jump-nav — a thin blurred layer so the long page is navigable
          on a phone in one tap instead of a multi-thousand-pixel scroll. */}
      <nav className="aurelius-jumpnav sticky top-0 z-20 -mx-6 px-6 py-2 mb-4 border-y border-aurelius-gold/15 overflow-x-auto">
        <div className="flex gap-2 text-[11px] whitespace-nowrap justify-start md:justify-center">
          {[
            ["read", "The read"], ["needs", "Needs you"], ["sell", "Sell"], ["say", "Say"],
            ["content", "Content"], ["warm", "Warm list"], ["pipeline", "Pipeline"], ["roster", "Roster"], ["growth", "Growth"],
          ].map(([id, label]) => (
            <a
              key={id} href={`#${id}`}
              className="px-2.5 py-1 border border-aurelius-gold/25 text-aurelius-gold/75 hover:text-aurelius-gold hover:border-aurelius-gold/55 transition-colors"
              style={{ ...bodyFont, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".18em", borderRadius: 2 }}
            >
              {label}
            </a>
          ))}
        </div>
      </nav>

      {error && (
        <div className="rounded-[2px] border border-red-500/40 bg-red-950/20 p-3 text-sm text-red-200 mb-4">{error}</div>
      )}
      {notice && (
        <div className="rounded-[2px] border border-emerald-500/40 bg-emerald-950/20 p-3 text-sm text-emerald-200 mb-4 flex items-center justify-between gap-3">
          <span>{notice}</span>
          {notice.toLowerCase().includes("gmail") && (
            <a href="https://mail.google.com/mail/u/0/#drafts" target="_blank" rel="noreferrer" className="shrink-0 underline hover:text-emerald-100">
              open Gmail drafts →
            </a>
          )}
        </div>
      )}

      <div className="aurelius-reveal space-y-8">
      {/* THE ANALYST — one confronting truth about the funnel, spoken as the
          oracle line. Names the leak before the win; refuses to crown a winner
          on too little data. */}
      {analyst && (
        <section id="read" className="scroll-mt-24">
          <SectionLabel>The read</SectionLabel>
          <p style={{
            ...bodyFont, margin: "1.4rem auto 0", maxWidth: "44rem", textAlign: "center",
            fontWeight: 500, fontStyle: "italic", fontSize: "clamp(1.25rem,3vw,1.6rem)",
            lineHeight: 1.65, color: "var(--ink)",
          }}>
            {analyst.truth}
          </p>
          {analyst.ranked.length > 0 && (
            <ul className="mt-4 text-xs space-y-1 max-w-md mx-auto">
              {analyst.ranked.map((c) => (
                <li key={c.channel} className="flex justify-between gap-3 text-neutral-400">
                  <span className="text-neutral-300" style={{ ...bodyFont, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".18em" }}>{c.channel}</span>
                  <span style={{ ...dataFont, fontVariantNumeric: "tabular-nums", letterSpacing: ".04em" }}>
                    {c.clicks} click{c.clicks === 1 ? "" : "s"} · {c.leads} lead{c.leads === 1 ? "" : "s"}
                    {c.conversionPct != null ? ` · ${c.conversionPct}% conv` : ""}
                    {c.earnedCents > 0 ? ` · ${money(c.earnedCents)}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {analyst.tooEarly.length > 0 && (
            <p className="au-kicker mt-3" style={{ display: "block", textAlign: "center", fontSize: 13 }}>
              Too early to rank: {analyst.tooEarly.map((c) => c.channel).join(", ")} — not enough data yet.
            </p>
          )}
        </section>
      )}

      {/* ── What costs money if ignored — THE glass tablet. The analyst reads
          the situation, this is the to-do it produces. ─ */}
      {attentionCount > 0 && (
        <Panel tier="glass" id="needs" label={`Needs you · ${roman(attentionCount)}`} labelGold>
          <ul className="space-y-2 text-sm">
            {attention.blocksEnding.map((b) => (
              <li key={b.engagementId} className="flex justify-between gap-4 text-aurelius-text/90">
                <span><strong style={{ color: "var(--gold)" }}>{b.client}</strong> — {b.title} ends {day(b.endsAt)}. Re-sign conversation is now.</span>
              </li>
            ))}
            {attention.renewalsDue.map((r) => (
              <li key={r.engagementId} className="flex justify-between gap-4 text-aurelius-text/90">
                <span><strong style={{ color: "var(--gold)" }}>{r.client}</strong> — {r.amount} renews {day(r.nextBillingAt)}.</span>
              </li>
            ))}
            {attention.followUpsOverdue.map((f) => (
              <li key={f.leadId} className="flex justify-between gap-4" style={{ color: "var(--attn)" }}>
                <span><strong>{f.name}</strong> — {f.action ?? "follow up"} was due {day(f.dueAt)}.</span>
              </li>
            ))}
            {attention.unpaid.map((u) => (
              <li key={u.id} className="flex justify-between gap-4" style={u.overdue ? { color: "var(--danger)" } : undefined}>
                <span className={u.overdue ? undefined : "text-aurelius-text/90"}>
                  <strong>{u.client}</strong> owes {money(u.outstandingCents)}
                  {u.description ? ` — ${u.description}` : ""}{u.overdue ? " (overdue)" : ""}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {/* ── The honest headline ──────────────────────────────────── */}
      {snap.empty ? (
        <section className="au-card p-5 scroll-mt-24" style={{ borderColor: "rgba(217,164,65,.4)" }}>
          <div className="au-label-row" style={{ color: "var(--attn)", marginBottom: ".8rem" }}>
            The pipeline is empty
          </div>
          <p className="text-aurelius-text/90 leading-relaxed">
            No clients, no open leads. The constraint isn&apos;t tracking — it&apos;s that nothing arrives on its own.
            This roster can&apos;t help you until there&apos;s someone in it, and building more machinery won&apos;t
            change that.
          </p>
          <p className="text-aurelius-text/80 mt-3 text-sm leading-relaxed">
            The shortest path from here is the warm list: the ten people you could message this week who might say
            yes, or who know someone who would. Old athletes, their parents, coaches you know. Start right below.
          </p>
        </section>
      ) : (
        <section className={`grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-8 scroll-mt-24 ${lit ? "au-lit" : ""}`}>
          <Stat label="Active clients" value={String(snap.activeClients)} />
          <Stat label="Open leads" value={String(snap.openLeads)} />
          <Stat label="Committed / mo" value={snap.mrr} hint={`${snap.engagementsByShape.monthly} monthly`} />
          <Stat
            label="Received this month"
            tone={snap.overdueCount > 0 ? "alert" : "money"}
            countUpCents={snap.receivedThisMonthCents}
            value={snap.receivedThisMonth}
            hint={snap.outstandingCents > 0 ? `${snap.outstanding} outstanding` : undefined}
          />
        </section>
      )}

      {/* When there's nothing yet, the warm list IS the page — render it right
          under the empty banner (its own stated "shortest path"), not 4th. */}
      {snap.empty && (
        <div id="warm" className="scroll-mt-24"><WarmList onChange={load} empty={snap.empty} /></div>
      )}

      {/* ── The treasury: earned money, traced to what earned it — and what
          it cost. Renders on spend alone too: a business earning nothing and
          spending something is NEGATIVE, and hiding that would be the exact
          encouraging-zeroes failure this page refuses. ─ */}
      {ledger && (ledger.earnedCents > 0 || (expenses?.spentCents ?? 0) > 0) && (
        <section className={`scroll-mt-24 ${lit ? "au-lit" : ""}`}>
          <SectionLabel>The treasury</SectionLabel>
          <div style={{ height: "1.1rem" }} />
          <div style={{
            ...dataFont, display: "flex", gap: "1.4rem", flexWrap: "wrap", justifyContent: "center",
            fontWeight: 600, fontSize: 13.5, letterSpacing: ".06em", textTransform: "uppercase",
            color: "var(--ink3)", marginBottom: ".9rem", fontVariantNumeric: "tabular-nums",
          }}>
            <span>
              <i style={{ display: "inline-block", width: 8, height: 8, borderRadius: 1, marginRight: ".45em", background: "var(--money)" }} />
              <b style={{ color: "var(--money)" }}>{snap.receivedThisMonth}</b>&nbsp;received
            </span>
            {snap.outstandingCents > 0 && (
              <span>
                <i style={{ display: "inline-block", width: 8, height: 8, borderRadius: 1, marginRight: ".45em", background: "var(--attn)" }} />
                <b style={{ color: "var(--attn)" }}>{snap.outstanding}</b>&nbsp;outstanding
                {snap.overdueCount > 0 ? ` · ${snap.overdueCount} overdue` : ""}
              </span>
            )}
            <span>
              <i style={{ display: "inline-block", width: 8, height: 8, borderRadius: 1, marginRight: ".45em", border: "1px solid var(--gold-line)", background: "none" }} />
              of&nbsp;<b style={{ color: "var(--ink2)" }}>{snap.mrr}/mo</b>&nbsp;committed
            </span>
            {/* The spent chip — what the month COST, top category named.
                The tooltip carries the quarterly estimated-tax reminder. */}
            {expenses && expenses.spentCents > 0 && (
              <span title={expenses.quarterEstimateNote}>
                <i style={{ display: "inline-block", width: 8, height: 8, borderRadius: 1, marginRight: ".45em", background: "var(--danger)" }} />
                <b style={{ color: "var(--danger)" }}>{expenses.spent}</b>&nbsp;spent
                {expenses.byCategory[0]
                  ? ` · ${expenses.byCategory[0].category === "software" ? "tools" : expenses.byCategory[0].category}`
                  : ""}
              </span>
            )}
            {/* The net chip — earned − spent, the sentence the treasury never
                said. Honest sign: green when ahead, danger when the month is
                underwater (which, pre-revenue, is the truth worth seeing). */}
            {pnl && (pnl.netThisMonthCents !== 0 || (expenses?.spentCents ?? 0) > 0) && (
              <span title={pnl.headline}>
                <i style={{ display: "inline-block", width: 8, height: 8, borderRadius: 1, marginRight: ".45em", background: pnl.netThisMonthCents >= 0 ? "var(--money)" : "var(--danger)" }} />
                <b style={{ color: pnl.netThisMonthCents >= 0 ? "var(--money)" : "var(--danger)" }}>{pnl.netThisMonth}</b>&nbsp;net
              </span>
            )}
          </div>
          <div className="au-tre" style={{ maxWidth: 760, margin: "0 auto" }}>
            <div className="au-tre-committed" />
            {receivedCents > 0 && <div className="au-tre-seg au-tre-recv" style={{ width: `${treRecvPct}%` }} />}
            {snap.outstandingCents > 0 && (
              <div className="au-tre-seg au-tre-out" style={{ left: `calc(${treRecvPct}% + 4px)`, width: `${treOutPct}%` }} />
            )}
          </div>
          <p className="au-kicker" style={{ display: "block", textAlign: "center", marginTop: "1rem", fontSize: 14 }}>
            {ledger.paymentCount} payment{ledger.paymentCount === 1 ? "" : "s"} recorded
            {ledger.selfRecordedCents > 0 ? ` · ${money(ledger.selfRecordedCents)} self-recorded by Aurelius` : ""}
          </p>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-8 mt-8">
            <Stat label="Earned all-time" tone="money" countUpCents={ledger.earnedCents} value={ledger.earned} />
            <Stat label="Earned this month" value={ledger.earnedThisMonth} />
            {ledger.byChannel[0] && ledger.byChannel[0].channel !== "unattributed" && (
              <Stat
                label="Top channel"
                value={<span style={{ fontSize: "1.5rem" }}>{ledger.byChannel[0].channel}</span>}
                hint={ledger.byChannel[0].label}
              />
            )}
          </div>

          {ledger.byChannel.length > 0 && (
            <div className="mt-6 text-xs text-neutral-400 space-y-1 max-w-md mx-auto">
              <div style={{ ...bodyFont, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".22em", color: "var(--ink3)" }}>Earned by channel</div>
              {ledger.byChannel.map((c) => (
                <div key={c.channel} className="flex justify-between gap-4">
                  <span>{c.channel}</span>
                  <span style={{ color: "var(--money)" }}>{c.label}</span>
                </div>
              ))}
            </div>
          )}
          {ledger.byAngle.length > 0 && (
            <div className="mt-4 text-xs text-neutral-400 space-y-1 max-w-md mx-auto">
              <div style={{ ...bodyFont, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".22em", color: "var(--ink3)" }}>Earned by angle</div>
              {ledger.byAngle.map((a) => (
                <div key={a.angle} className="flex justify-between gap-4">
                  <span className="truncate">{a.angle}</span>
                  <span className="shrink-0" style={{ color: "var(--money)" }}>{a.label}</span>
                </div>
              ))}
            </div>
          )}
          <p className="au-kicker" style={{ display: "block", textAlign: "center", marginTop: "1.2rem", fontSize: 13 }}>
            Earned is money that actually arrived — the sum of payments, never a projection. Committed/mo above is what recurs; this is what landed.
          </p>
        </section>
      )}

      <Divider capital />

      {/* The funnel, in order: what you sell → what you say → who you say it
          to → who's in → who's paying. Each section stays on screen when it's
          empty, because an empty one is the instruction. */}

      {/* ── 1. What you sell ─────────────────────────────────────── */}
      <div id="sell" className="scroll-mt-24"><OfferPanel offers={offers ?? []} state={offerState} probe={probe} onChange={load} /></div>

      {/* ── 2. What you say ──────────────────────────────────────── */}
      <div id="say" className="scroll-mt-24"><MarketingPanel marketing={marketing} hasOffer={offerState?.hasActive ?? false} onChange={load} /></div>

      {/* ── 3. What you've written, and whether any of it went out ─ */}
      <div id="content" className="scroll-mt-24"><ContentQueue drafts={drafts ?? []} state={contentState} onChange={load} /></div>

      {/* ── 4. The warm list (when there's already a pipeline) ────── */}
      {!snap.empty && (
        <div id="warm" className="scroll-mt-24"><WarmList onChange={load} empty={snap.empty} /></div>
      )}

      <Divider />

      {/* ── Add a lead ───────────────────────────────────────────── */}
      <section className="au-card p-4">
        <SectionLabel row>Add someone</SectionLabel>
        <div style={{ height: ".9rem" }} />
        <form onSubmit={addLead} className="grid grid-cols-1 md:grid-cols-5 gap-2">
          <input
            value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" required
            aria-label="Name" autoCapitalize="words" autoComplete="name"
            className="md:col-span-1 bg-black/50 border border-aurelius-gold/30 rounded-[2px] px-3 py-2 text-sm text-aurelius-text placeholder:text-aurelius-text/60"
          />
          <input
            value={sport} onChange={(e) => setSport(e.target.value)} placeholder="Sport"
            className="bg-black/50 border border-aurelius-gold/30 rounded-[2px] px-3 py-2 text-sm text-aurelius-text placeholder:text-aurelius-text/30"
          />
          <select
            value={source} onChange={(e) => setSource(e.target.value)}
            className="bg-black/50 border border-aurelius-gold/30 rounded-[2px] px-3 py-2 text-sm text-aurelius-text"
          >
            {SOURCES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
          </select>
          <input
            value={referredBy} onChange={(e) => setReferredBy(e.target.value)} placeholder="Referred by"
            className="bg-black/50 border border-aurelius-gold/30 rounded-[2px] px-3 py-2 text-sm text-aurelius-text placeholder:text-aurelius-text/30"
          />
          <input
            value={nextAction} onChange={(e) => setNextAction(e.target.value)} placeholder="Next action"
            className="bg-black/50 border border-aurelius-gold/30 rounded-[2px] px-3 py-2 text-sm text-aurelius-text placeholder:text-aurelius-text/30"
          />
          {/* The one primary of this section — the letterpress gold. */}
          <Btn type="submit" disabled={busy || !name.trim()} className="md:col-span-5 mt-1">
            {busy ? "Saving…" : "Add to pipeline"}
          </Btn>
        </form>
      </section>

      {/* ── Pipeline: the colonnade above, the workbench below ───── */}
      {leads.length > 0 && (
        <section id="pipeline" className="scroll-mt-24">
          <SectionLabel>
            The pipeline{openLeads.length > 0 ? <> · <span key={openLeads.length} className="au-tickin">{openLeads.length}</span></> : null}
          </SectionLabel>

          {/* THE FUNNEL COLONNADE — five chambers, floor-glow by count, one
              dot per lead with momentum heat. Same data as the kanban. */}
          <FunnelColonnade leads={leads} />

          {openLeads.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-8">
              {STAGES.map((stage) => {
                const inStage = openLeads.filter((l) => l.status === stage);
                return (
                  <div key={stage} className="min-h-[4rem]">
                    <div style={{
                      ...bodyFont, fontWeight: 600, fontSize: 12, letterSpacing: ".24em",
                      textTransform: "uppercase", color: "var(--ink3)", marginBottom: ".6rem", textAlign: "center",
                    }}>
                      {stage} · <b style={{ color: "var(--ink2)", fontVariantNumeric: "tabular-nums" }}>
                        <span key={inStage.length} className="au-tickin">{inStage.length}</span>
                      </b>
                    </div>
                    <div className="space-y-2">
                      {inStage.map((l) => (
                        <div
                          key={l.id} data-flip-id={l.id}
                          className="au-card p-3 text-sm"
                          style={{ borderLeft: `2px solid ${heatBorder(l.lastContactAt)}` }}
                        >
                          <div className="flex justify-between gap-2">
                            <span className="text-aurelius-text/90">{l.name}</span>
                            <span style={{ ...dataFont, fontSize: 11.5, color: "var(--ink3)", fontVariantNumeric: "tabular-nums" }}>
                              {ageLabel(l.lastContactAt)}
                            </span>
                          </div>
                          {(l.sport || l.referredBy) && (
                            <div className="au-kicker" style={{ fontSize: 13 }}>
                              {[l.sport, l.referredBy ? `via ${l.referredBy}` : null].filter(Boolean).join(" · ")}
                            </div>
                          )}
                          {l.nextAction && (
                            <div className="text-[11px] mt-1" style={{ color: "var(--attn)" }}>→ {l.nextAction}</div>
                          )}
                          <div className="flex flex-wrap gap-2 mt-2">
                            {STAGES.indexOf(stage) < STAGES.length - 1 && (
                              <button
                                onClick={() => moveLead(l.id, STAGES[STAGES.indexOf(stage) + 1]!)}
                                disabled={busy}
                                className="text-[11px] px-2 py-1 rounded-[2px] border border-aurelius-gold/40 text-aurelius-gold/80 hover:text-aurelius-gold hover:border-aurelius-gold/70 disabled:opacity-40"
                                style={{ ...bodyFont, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".1em" }}
                              >
                                advance →
                              </button>
                            )}
                            <button
                              onClick={() => convert(l.id)} disabled={busy}
                              className="text-[11px] px-2 py-1 rounded-[2px] text-emerald-400/90 hover:text-emerald-300 hover:bg-emerald-500/10 disabled:opacity-40"
                              style={{ ...bodyFont, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".1em" }}
                            >
                              signed
                            </button>
                            <button
                              onClick={async () => {
                                setBusy(true); setError(null); setNotice(null);
                                try {
                                  const res = await fetch("/api/crm/leads/draft", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ kind: "draft", leadId: l.id }),
                                  });
                                  const j = await res.json();
                                  if (!res.ok) throw new Error(j?.error ?? "Draft failed");
                                  await load();
                                  setNotice(`Drafted a message to ${l.name} in your Gmail drafts — review and send.`);
                                } catch (e: any) { setError(e?.message ?? String(e)); }
                                finally { setBusy(false); }
                              }}
                              disabled={busy}
                              className="text-[11px] px-2 py-1 rounded-[2px] text-aurelius-gold/80 hover:text-aurelius-gold hover:bg-aurelius-gold/10 disabled:opacity-40"
                              style={{ ...bodyFont, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".1em" }}
                              title="Researches them and drafts a message into your Gmail drafts. Never sends."
                            >
                              draft msg
                            </button>
                            <button
                              onClick={() => moveLead(l.id, "lost")} disabled={busy}
                              className="text-[11px] px-2 py-1 rounded-[2px] text-aurelius-text/50 hover:text-aurelius-text/80 disabled:opacity-40"
                              style={{ ...bodyFont, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".1em" }}
                            >
                              lost
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* ── Roster ───────────────────────────────────────────────── */}
      {clients.length > 0 && (
        <section id="roster" className="au-card p-4 scroll-mt-24">
          <SectionLabel row>Roster · {clients.length}</SectionLabel>
          <div style={{ height: ".6rem" }} />
          <ul className="divide-y divide-aurelius-gold/10">
            {clients.map((c) => (
              <li key={c.id} className="py-2">
                <button
                  onClick={() => setOpenClient(openClient === c.id ? null : c.id)}
                  className="w-full flex justify-between items-center gap-4 text-left hover:text-aurelius-gold"
                >
                  <div>
                    <div className="text-aurelius-text/90 text-sm">{c.name}</div>
                    <div className="au-kicker" style={{ fontSize: 13 }}>
                      {[c.sport, c.status !== "active" ? c.status : null].filter(Boolean).join(" · ") || "—"}
                    </div>
                  </div>
                  <div className="text-right text-[11px] text-aurelius-text/60">
                    {c.engagements.length === 0 ? (
                      // This label used to be a dead end — the page said an
                      // engagement was missing and gave no way to add one.
                      <span style={{ color: "var(--attn)" }}>no engagement recorded — tap to add</span>
                    ) : (
                      c.engagements.map((e) => (
                        <div key={e.id}>{e.title} · {money(e.priceCents)}{e.shape === "monthly" ? "/mo" : ""}</div>
                      ))
                    )}
                  </div>
                </button>
                {openClient === c.id && <ClientMoneyPanel clientId={c.id} name={c.name} onChange={load} />}
              </li>
            ))}
          </ul>
        </section>
      )}

      <Divider />

      {/* ── Growth: integrations, partnerships, paid ─────────────── */}
      <div id="growth" className="scroll-mt-24"><GrowthPanel /></div>

      {/* ── Tracked links: DIAGNOSTICS — demoted to the bottom of the page. ─ */}
      {trackLinks && trackLinks.length > 0 && (
        <section className="scroll-mt-24">
          <SectionLabel>Diagnostics — your links</SectionLabel>
          <p className="au-kicker" style={{ display: "block", textAlign: "center", marginTop: ".4rem", fontSize: 13 }}>
            clicks → leads, per link
          </p>
          <ul className="space-y-1.5 text-xs max-w-2xl mx-auto mt-3">
            {trackLinks.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-3">
                <span className="flex-1 min-w-0 truncate text-neutral-300">
                  <span className="text-neutral-500">{l.channel}</span>
                  {l.label ? <span> · {l.label}</span> : null}
                  <span className="text-neutral-500"> · /l/{l.code}</span>
                </span>
                <span className="text-neutral-400 shrink-0" style={{ ...dataFont, fontVariantNumeric: "tabular-nums", letterSpacing: ".04em" }}>
                  {l.clickCount} click{l.clickCount === 1 ? "" : "s"} · {l._count.leads} lead{l._count.leads === 1 ? "" : "s"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      </div>
      </div>
    </div>
  );
}

/**
 * THE FUNNEL COLONNADE — five chambers (four stages + the won coin) with a
 * floor-glow proportional to occupancy and one dot per open lead, placed in
 * its chamber and re-laid-out whenever the data changes. Dots travel on their
 * own CSS transform transition, so an advance is a procession, not a repaint.
 * Conversion labels are honest "n of m" — no percentages under n=10.
 */
function FunnelColonnade({ leads }: { leads: Lead[] }) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<Record<string, { x: number; y: number }>>({});

  const open = leads
    .filter((l) => (STAGES as readonly string[]).includes(l.status))
    .sort((a, b) => (a.id < b.id ? -1 : 1)); // stable order by id
  const counts = STAGES.map((s) => open.filter((l) => l.status === s).length);
  const won = leads.filter((l) => l.status === "won").length;
  const maxCount = Math.max(1, ...counts);
  // reached[i] = leads that made it at least as far as stage i (won counts for all)
  const reached = STAGES.map((_, i) => counts.slice(i).reduce((a, b) => a + b, 0) + won);

  const layout = useCallback(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const w = wrap.getBoundingClientRect();
    const next: Record<string, { x: number; y: number }> = {};
    wrap.querySelectorAll<HTMLElement>("[data-chamber]").forEach((ch) => {
      const stage = ch.dataset.chamber!;
      const r = ch.getBoundingClientRect();
      const inStage = open.filter((l) => l.status === stage);
      const perRow = Math.max(1, Math.floor((r.width - 24) / 15));
      inStage.forEach((l, j) => {
        const row = Math.floor(j / perRow);
        const col = j % perRow;
        const inRow = Math.min(perRow, inStage.length - row * perRow);
        next[l.id] = {
          x: r.left - w.left + r.width / 2 + (col - (inRow - 1) / 2) * 15 - 5,
          y: r.top - w.top + Math.max(40, r.height - 32 - row * 13),
        };
      });
    });
    setPos(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leads]);

  useLayoutEffect(() => { layout(); }, [layout]);
  useEffect(() => {
    window.addEventListener("resize", layout);
    return () => window.removeEventListener("resize", layout);
  }, [layout]);

  const chLabel = {
    ...bodyFont, fontWeight: 600, fontSize: 11.5, letterSpacing: ".26em",
    textTransform: "uppercase", color: "var(--ink3)",
  } as const;

  return (
    <div>
      {/* extra headroom for the italic "n of m" labels that ride above the arches */}
      <div ref={wrapRef} className="au-chambers" style={{ marginTop: "2.8rem" }}>
        {STAGES.map((stage, i) => (
          <div
            key={stage} data-chamber={stage} className="au-chamber"
            style={{ ["--heat" as any]: counts[i] / maxCount }}
          >
            {i > 0 && reached[i - 1] > 0 && (
              <span className="au-conv">
                {reached[i]} of {reached[i - 1]}
                {reached[i - 1] >= 10 ? ` · ${Math.round((reached[i] / reached[i - 1]) * 100)}%` : ""}
              </span>
            )}
            <b className="au-cc"><span key={counts[i]} className="au-tickin">{counts[i]}</span></b>
            <span className="au-ch">{stage}</span>
          </div>
        ))}
        {/* the won coin — the chamber the whole colonnade empties into */}
        <div className="au-chamber" style={{ ["--heat" as any]: won > 0 ? 1 : 0 }}>
          <div style={{ position: "absolute", inset: 0, display: "grid", placeContent: "center", gap: ".15rem", textAlign: "center" }}>
            <b style={{ ...serifFont, fontWeight: 700, fontSize: "1.6rem", color: "var(--gold)", fontVariantNumeric: "tabular-nums" }}>
              <span key={won} className="au-tickin">{won}</span>
            </b>
            <span style={chLabel}>won</span>
          </div>
        </div>
        <div className="au-dots">
          {open.map((l) => {
            const p = pos[l.id];
            return (
              <span
                key={l.id}
                className={`au-dot ${dotHeat(l.lastContactAt)}`}
                style={p
                  ? { left: 0, top: 0, transform: `translate(${p.x}px, ${p.y}px)` }
                  : { left: 0, top: 0, opacity: 0 }}
              />
            );
          })}
        </div>
      </div>
      <p className="au-kicker" style={{ display: "block", textAlign: "center", marginTop: ".8rem", fontSize: 13 }}>
        each mark is a lead — gold was touched within two days, faded is cooling, grey has gone cold, hollow was never contacted
      </p>
    </div>
  );
}

type Detail = {
  client: { id: string; name: string };
  engagements: { id: string; shape: string; title: string; priceCents: number; endsAt: string | null; nextBillingAt: string | null; status: string }[];
  invoices: { id: string; amountCents: number; description: string | null; status: string; dueAt: string | null }[];
  payments: { id: string; amountCents: number; method: string; receivedAt: string }[];
  lifetime: string;
};

/**
 * The money half of a client, and the only place it can be entered.
 *
 * Everything here is an INWARD book entry. "Invoice" records that an amount is
 * owed — it does not send anything to anyone; sending is outward and stops for
 * Cole's confirm. The button says so, because a button labelled "invoice" that
 * silently emails a parent would be the worst kind of surprise.
 */
function ClientMoneyPanel({ clientId, name, onChange }: { clientId: string; name: string; onChange: () => void }) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [shape, setShape] = useState("monthly");
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [weeks, setWeeks] = useState("8");
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("venmo");
  const [invAmount, setInvAmount] = useState("");
  const [invDesc, setInvDesc] = useState("");
  const [sessionKind, setSessionKind] = useState("check_in");
  const [sessionNotes, setSessionNotes] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/crm/clients/${clientId}`);
      if (!res.ok) return setFailed(true);
      setDetail(await res.json());
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [clientId]);

  useEffect(() => { load(); }, [load]);

  async function post(body: Record<string, unknown>) {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/crm/money", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, clientId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Failed");
      await load();
      onChange();
      return true;
    } catch (e: any) {
      setErr(e?.message ?? String(e));
      return false;
    } finally {
      setBusy(false);
    }
  }

  const field =
    "bg-black/50 border border-aurelius-gold/30 rounded-[2px] px-2 py-1.5 text-sm text-aurelius-text placeholder:text-aurelius-text/30";
  const btn =
    "px-3 py-1.5 rounded-[2px] border border-aurelius-gold/50 text-aurelius-gold text-xs hover:bg-aurelius-gold/10 disabled:opacity-40";

  if (failed) {
    return (
      <div className="mt-3 rounded-[2px] border border-red-500/40 bg-red-950/20 p-3 text-xs text-red-200">
        Couldn&apos;t load {name}&apos;s record — that&apos;s a loading failure, not an empty one.
        <button onClick={load} className="ml-2 underline">Retry</button>
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-[2px] border border-aurelius-gold/20 bg-black/50 p-3 space-y-4">
      {err && <div className="rounded-[2px] border border-red-500/40 bg-red-950/20 p-2 text-xs text-red-200">{err}</div>}

      <RetentionSection clientId={clientId} onChange={onChange} />

      {detail && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[11px]">
          <div>
            <div className="uppercase tracking-[0.2em] text-aurelius-gold/50 mb-1" style={bodyFont}>Engagements</div>
            {detail.engagements.length === 0 ? (
              <div className="text-aurelius-text/60">none</div>
            ) : (
              detail.engagements.map((e) => (
                <div key={e.id} className="text-aurelius-text/80">
                  {e.title} · {money(e.priceCents)}{e.shape === "monthly" ? "/mo" : ""}
                  {e.endsAt && <span style={{ color: "var(--attn)" }}> · ends {day(e.endsAt)}</span>}
                  {e.nextBillingAt && <span className="text-aurelius-text/50"> · renews {day(e.nextBillingAt)}</span>}
                  {/* The re-sign conversation the risk line nags about now has
                      a button to end it — either outcome, one tap. */}
                  {e.status === "active" && (
                    <span className="ml-2">
                      <button
                        disabled={busy}
                        onClick={() => post({ kind: "engagement_patch", engagementId: e.id, status: "completed" })}
                        className="text-[10px] text-aurelius-text/60 hover:text-aurelius-text/70 disabled:opacity-40"
                      >
                        completed
                      </button>
                      <span className="text-aurelius-text/20"> · </span>
                      <button
                        disabled={busy}
                        onClick={() => post({ kind: "engagement_patch", engagementId: e.id, status: "cancelled" })}
                        className="text-[10px] text-aurelius-text/60 hover:text-red-300 disabled:opacity-40"
                      >
                        cancelled
                      </button>
                    </span>
                  )}
                  {e.status !== "active" && <span className="text-aurelius-text/60"> · {e.status}</span>}
                </div>
              ))
            )}
          </div>
          <div>
            <div className="uppercase tracking-[0.2em] text-aurelius-gold/50 mb-1" style={bodyFont}>Owed</div>
            {detail.invoices.filter((i) => i.status !== "paid" && i.status !== "void").length === 0 ? (
              <div className="text-aurelius-text/60">nothing outstanding</div>
            ) : (
              detail.invoices
                .filter((i) => i.status !== "paid" && i.status !== "void")
                .map((i) => (
                  <div key={i.id} className="text-aurelius-text/80">
                    {money(i.amountCents)} {i.description ? `· ${i.description}` : ""}
                    {i.dueAt && <span className="text-aurelius-text/50"> · due {day(i.dueAt)}</span>}
                  </div>
                ))
            )}
          </div>
          <div>
            <div className="uppercase tracking-[0.2em] text-aurelius-gold/50 mb-1" style={bodyFont}>Received · {detail.lifetime} lifetime</div>
            {detail.payments.length === 0 ? (
              <div className="text-aurelius-text/60">nothing yet</div>
            ) : (
              detail.payments.slice(0, 4).map((p) => (
                <div key={p.id} className="text-aurelius-text/80">
                  {money(p.amountCents)} · {p.method} · {day(p.receivedAt)}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* what they bought */}
      <div className="flex flex-wrap gap-2 items-center">
        <select value={shape} onChange={(e) => setShape(e.target.value)} className={field}>
          <option value="monthly">monthly</option>
          <option value="block">block</option>
          <option value="program">program</option>
        </select>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What they bought" className={`${field} flex-1 min-w-[10rem]`} />
        <input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="$" inputMode="decimal" className={`${field} w-24`} />
        {shape === "block" && (
          <input value={weeks} onChange={(e) => setWeeks(e.target.value)} placeholder="weeks" inputMode="numeric" className={`${field} w-20`} />
        )}
        <button
          disabled={busy || !title.trim() || !price.trim()}
          className={btn}
          onClick={async () => {
            const ok = await post({
              kind: "engagement", shape, title: title.trim(),
              price: Number(price), ...(shape === "block" ? { weeks: Number(weeks) || 8 } : {}),
            });
            if (ok) { setTitle(""); setPrice(""); }
          }}
        >
          Add engagement
        </button>
      </div>

      {/* money in */}
      <div className="flex flex-wrap gap-2 items-center">
        <input value={payAmount} onChange={(e) => setPayAmount(e.target.value)} placeholder="Payment $" inputMode="decimal" className={`${field} w-28`} />
        <select value={payMethod} onChange={(e) => setPayMethod(e.target.value)} className={field}>
          {["venmo", "zelle", "cash", "stripe", "paypal", "bank", "other"].map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <button
          disabled={busy || !payAmount.trim()}
          className={btn}
          onClick={async () => {
            const ok = await post({ kind: "payment", amount: Number(payAmount), method: payMethod });
            if (ok) setPayAmount("");
          }}
        >
          Record payment
        </button>

        <span className="w-px h-6 bg-aurelius-gold/20 mx-1" />

        <input value={invAmount} onChange={(e) => setInvAmount(e.target.value)} placeholder="Owed $" inputMode="decimal" className={`${field} w-24`} />
        <input value={invDesc} onChange={(e) => setInvDesc(e.target.value)} placeholder="For what" className={`${field} flex-1 min-w-[8rem]`} />
        <button
          disabled={busy || !invAmount.trim()}
          className={btn}
          title="Records that this is owed. Nothing is sent — sending is an outward action and needs your confirm."
          onClick={async () => {
            const ok = await post({ kind: "invoice", amount: Number(invAmount), description: invDesc.trim() || undefined });
            if (ok) { setInvAmount(""); setInvDesc(""); }
          }}
        >
          Mark owed
        </button>
      </div>
      <p className="text-[10px] text-aurelius-text/60">
        &quot;Mark owed&quot; puts the amount on the books. It does not send anything — sending is outward and stops for your confirm.
      </p>

      {/* Delivery. `logSession` existed from the first CRM commit with no way
          to call it from the app — a check-in Cole can't log from his phone
          after a call is a check-in that never gets logged. */}
      <div className="flex flex-wrap gap-2 items-center pt-1 border-t border-aurelius-gold/10">
        <select value={sessionKind} onChange={(e) => setSessionKind(e.target.value)} className={field}>
          {["check_in", "call", "video_review", "test", "session"].map((k) => (
            <option key={k} value={k}>{k.replace(/_/g, " ")}</option>
          ))}
        </select>
        <input
          value={sessionNotes} onChange={(e) => setSessionNotes(e.target.value)}
          placeholder="What happened" className={`${field} flex-1 min-w-[10rem]`}
        />
        <button
          disabled={busy}
          className={btn}
          onClick={async () => {
            const ok = await post({ kind: "session", sessionKind, notes: sessionNotes.trim() || undefined });
            if (ok) setSessionNotes("");
          }}
        >
          Log it
        </button>

        <span className="w-px h-6 bg-aurelius-gold/20 mx-1" />

        <button
          disabled={busy}
          className="text-[11px] text-aurelius-text/60 hover:text-aurelius-text/70 disabled:opacity-40"
          onClick={() => post({ kind: "client_patch", status: "paused" })}
        >
          pause client
        </button>
        <button
          disabled={busy}
          className="text-[11px] text-aurelius-text/60 hover:text-aurelius-text/70 disabled:opacity-40"
          onClick={() => post({ kind: "client_patch", status: "ended" })}
        >
          mark ended
        </button>
      </div>
    </div>
  );
}

/**
 * THE OFFER — the thing every message points at.
 *
 * Always rendered, including (especially) when it is empty: with no offer, the
 * emptiness IS the finding, and hiding the section would let Cole go do
 * outreach for something that has no shape, no length and no price.
 *
 * Aurelius drafts; Cole prices and activates. The price field is his because a
 * confidently-wrong number is the one hallucination here that gets quoted to a
 * real buyer. "Make it live" is this section's one gold primary.
 */
function OfferPanel({ offers, state, probe, onChange }: { offers: Offer[]; state?: OfferState; probe?: Probe; onChange: () => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const live = offers.filter((o) => o.status === "active");
  const drafts = offers.filter((o) => o.status === "draft");

  // Build the tracked-link URL from the code against the current origin — always
  // correct for this deployment, no server env needed to display it.
  const linkFor = (code: string) =>
    typeof window !== "undefined" ? `${window.location.origin}/l/${code}` : `/l/${code}`;
  async function copyLink(code: string) {
    try {
      await navigator.clipboard.writeText(linkFor(code));
      setCopied(code);
      setTimeout(() => setCopied((c) => (c === code ? null : c)), 1500);
    } catch { /* clipboard blocked — the link is visible to copy by hand */ }
  }

  async function post(body: Record<string, unknown>) {
    setBusy(true); setErr(null);
    try {
      const res = await fetch("/api/crm/offers", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error ?? "Failed");
      onChange();
      return j;
    } catch (e: any) { setErr(e?.message ?? String(e)); return null; }
    finally { setBusy(false); }
  }

  return (
    <section className="au-card p-4" style={state?.hasActive ? undefined : { borderColor: "rgba(217,164,65,.45)" }}>
      <div className="flex justify-between items-baseline gap-4 mb-2 flex-wrap">
        <SectionLabel row>What you sell</SectionLabel>
        <div className="flex gap-2">
          {!state?.hasActive && (
            <Btn
              ghost disabled={busy}
              onClick={() => post({ kind: "probe" })}
              title="Float 2–3 variants, each behind its own tracked link, and let real intake decide which promise lands."
            >
              {busy ? "Working…" : "Probe A/B"}
            </Btn>
          )}
          <Btn ghost disabled={busy} onClick={() => post({ kind: "draft" })}>
            {busy ? "Working…" : "Draft one"}
          </Btn>
        </div>
      </div>

      {/* THE PROBE — let the market pick the promise. Each variant carries its
          own tracked link; the one that pulls leads is the one to price. */}
      {probe && probe.variants.length > 0 && (
        <div className="rounded-[2px] border border-aurelius-gold/25 bg-black/30 p-3 mb-3">
          <div className="flex items-baseline justify-between mb-2">
            <span className="text-[11px] uppercase tracking-[0.2em] text-aurelius-gold/80" style={bodyFont}>Offer probe</span>
            <span className="au-kicker" style={{ fontSize: 12.5 }}>{probe.note}</span>
          </div>
          <ul className="space-y-1.5">
            {probe.variants.map((v) => {
              const leading = probe.leader?.offerId === v.offerId;
              return (
                <li key={v.offerId} className={`flex items-center justify-between gap-3 text-xs ${leading ? "text-aurelius-gold" : "text-neutral-300"}`}>
                  <span className="flex-1 min-w-0 truncate">
                    {leading && <span className="text-aurelius-gold mr-1">★</span>}
                    {v.name} <span className="text-neutral-600">· {v.shape}{v.status === "active" ? " · live" : ""}</span>
                  </span>
                  <span className="text-neutral-500 shrink-0" style={{ ...dataFont, fontVariantNumeric: "tabular-nums" }}>
                    {v.leads} lead{v.leads === 1 ? "" : "s"} · {v.clicks} click{v.clicks === 1 ? "" : "s"}
                  </span>
                  <button onClick={() => copyLink(v.code)} className="text-aurelius-gold/70 hover:text-aurelius-gold shrink-0" title={linkFor(v.code)}>
                    {copied === v.code ? "copied" : "copy link"}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      <p className={`text-xs mb-3 leading-relaxed ${state?.hasActive ? "text-aurelius-text/60" : ""}`}
        style={state?.hasActive ? undefined : { color: "var(--attn)" }}>
        {state?.headline ?? "Loading…"}
      </p>
      {err && <div className="rounded-[2px] border border-red-500/40 bg-red-950/20 p-2 text-xs text-red-200 mb-3">{err}</div>}

      {offers.length === 0 ? (
        <p className="text-xs text-aurelius-text/50 leading-relaxed">
          Aurelius will research how remote coaching offers are structured and draft one from your confirmed facts.
          It won&apos;t set a price — that number is yours, and a guessed one would end up quoted to a parent.
        </p>
      ) : (
        <ul className="divide-y divide-aurelius-gold/10">
          {[...live, ...drafts].map((o) => (
            <li key={o.id} className="py-3">
              <button onClick={() => setExpanded(expanded === o.id ? null : o.id)} className="w-full text-left flex justify-between items-start gap-4">
                <div>
                  <div className="text-sm text-aurelius-text/90">
                    {o.name}
                    <span className="ml-2 text-[10px] uppercase tracking-wider text-aurelius-text/60" style={bodyFont}>
                      {o.shape}{o.durationWeeks ? ` · ${o.durationWeeks}wk` : ""}
                    </span>
                  </div>
                  <div className="au-kicker" style={{ fontSize: 13 }}>{o.audience}</div>
                </div>
                <div className="text-right text-[11px] shrink-0">
                  <div style={{ color: o.status === "active" ? "var(--money)" : "var(--attn)" }}>
                    {o.status === "active" ? `live · ${o.priceCents != null ? money(o.priceCents) : "no price"}` : "draft"}
                  </div>
                  <div className={o.grounding === "external" ? "text-emerald-400/60" : o.grounding === "internal" ? "text-aurelius-gold/60" : "text-amber-300/60"}>
                    {o.grounding === "external" ? "research-backed" : o.grounding === "internal" ? "from your own data" : "unverified guess"}
                  </div>
                </div>
              </button>

              {expanded === o.id && (
                <div className="mt-2 space-y-2 text-[11px] text-aurelius-text/75 leading-relaxed">
                  <p><span className="text-aurelius-gold/60">Promise · </span>{o.promise}</p>
                  {o.format && <p><span className="text-aurelius-gold/60">Week to week · </span>{o.format}</p>}
                  {o.proof && <p><span className="text-aurelius-gold/60">Proof · </span>{o.proof}</p>}
                  {o.edge && <p><span className="text-aurelius-gold/60">Edge · </span>{o.edge}</p>}
                  {/* Assumptions are shown, never quietly dropped — they are
                      the difference between a drafted offer and a claim. */}
                  {o.assumptions && <p style={{ color: "var(--attn)" }}><span>Assumed · </span>{o.assumptions}</p>}

                  <div className="flex flex-wrap gap-2 items-center pt-1">
                    {o.status === "active" ? (
                      <button disabled={busy} onClick={() => post({ kind: "retire", offerId: o.id })}
                        className="text-[11px] text-aurelius-text/60 hover:text-aurelius-text/70 disabled:opacity-40">
                        stop selling this
                      </button>
                    ) : (
                      <>
                        <input
                          value={prices[o.id] ?? ""} onChange={(e) => setPrices({ ...prices, [o.id]: e.target.value })}
                          placeholder={o.shape === "monthly" ? "$ / month" : "$ total"} inputMode="decimal"
                          className="bg-black/50 border border-aurelius-gold/30 rounded-[2px] px-2 py-1.5 text-sm text-aurelius-text placeholder:text-aurelius-text/30 w-32"
                        />
                        <Btn
                          disabled={busy || !(prices[o.id] ?? "").trim()}
                          onClick={() => post({ kind: "activate", offerId: o.id, price: Number(prices[o.id]) })}
                          title="Makes this the offer every draft, email and DM points at."
                        >
                          Make it live
                        </Btn>
                      </>
                    )}
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * MARKETING — angles, the copy they produce, and what actually happened.
 *
 * This was read-only and hidden at zero angles, which meant the whole engine
 * was unreachable from the one screen Cole opens (CLAUDE.md rule 8: name the
 * invoker). It now renders always, and every claim carries its grounding —
 * he can't audit marketing advice, so how much to trust it travels with it.
 */
function MarketingPanel({ marketing, hasOffer, onChange }: { marketing?: Marketing; hasOffer: boolean; onChange: () => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ angleId: string; angle: string; body: string; trust: string; format: string } | null>(null);
  const [kept, setKept] = useState(false);
  const [format, setFormat] = useState("email");
  const angles = marketing?.angles ?? [];

  async function post(body: Record<string, unknown>) {
    setBusy(true); setErr(null);
    try {
      const res = await fetch("/api/crm/marketing", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error ?? "Failed");
      return j;
    } catch (e: any) { setErr(e?.message ?? String(e)); return null; }
    finally { setBusy(false); }
  }

  const btn = "px-3 py-1.5 rounded-[2px] border border-aurelius-gold/50 text-aurelius-gold text-xs hover:bg-aurelius-gold/10 disabled:opacity-40";

  return (
    <section className="au-card p-4">
      <div className="flex justify-between items-baseline gap-4 mb-2 flex-wrap">
        <SectionLabel row>What you say</SectionLabel>
        <Btn ghost disabled={busy} onClick={async () => { if (await post({ kind: "propose", count: 3 })) onChange(); }}>
          {busy ? "Researching…" : "Propose angles"}
        </Btn>
      </div>

      {/* The honest read on sample size comes FIRST — a 33% reply rate from
          three sends is noise, and printing it as a rate teaches him something
          false about his own market. */}
      <p className="text-xs text-aurelius-text/60 mb-3">
        {marketing?.headline ?? "No angles yet. An angle is a testable claim about what makes one specific person reply."}
      </p>
      {!hasOffer && angles.length > 0 && (
        <p className="text-[11px] mb-3" style={{ color: "var(--attn)" }}>
          No offer is live, so this copy can start a conversation but can&apos;t close one. Define an offer above first.
        </p>
      )}
      {err && <div className="rounded-[2px] border border-red-500/40 bg-red-950/20 p-2 text-xs text-red-200 mb-3">{err}</div>}

      {angles.length > 0 && (
        <>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] uppercase tracking-[0.2em] text-aurelius-gold/50" style={bodyFont}>write as</span>
            <select value={format} onChange={(e) => setFormat(e.target.value)}
              className="bg-black/50 border border-aurelius-gold/30 rounded-[2px] px-2 py-1 text-xs text-aurelius-text">
              {["email", "instagram_post", "instagram_carousel", "dm", "landing_section"].map((f) => (
                <option key={f} value={f}>{f.replace(/_/g, " ")}</option>
              ))}
            </select>
          </div>
          <ul className="divide-y divide-aurelius-gold/10">
            {angles.map((a) => (
              <li key={a.id} className="py-2 flex justify-between items-start gap-4">
                <div className="min-w-0">
                  <div className="text-sm text-aurelius-text/90">{a.title}</div>
                  <div className="au-kicker" style={{ fontSize: 13 }}>{a.audience}</div>
                  {/* The citation, openable. "research-backed" printed in gold
                      over a claim you can't check is worse than no label. */}
                  {a.sources?.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-1">
                      {a.sources.slice(0, 4).map((s, i) => (
                        <a
                          key={i} href={s.url} target="_blank" rel="noreferrer"
                          className="text-[10px] text-aurelius-gold/50 hover:text-aurelius-gold underline decoration-dotted truncate max-w-[14rem]"
                          title={s.title}
                        >
                          {s.title?.slice(0, 40) ?? s.url}
                        </a>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-3 mt-1">
                    <button
                      disabled={busy}
                      onClick={async () => {
                        const j = await post({ kind: "draft", angleId: a.id, format });
                        if (j) { setKept(false); setDraft({ angleId: a.id, angle: a.title, body: j.body, trust: j.groundingNote, format }); }
                      }}
                      className="text-[11px] text-aurelius-gold/70 hover:text-aurelius-gold disabled:opacity-40"
                    >
                      write one
                    </button>
                    <button
                      disabled={busy}
                      onClick={async () => { if (await post({ kind: "outcome", angleId: a.id, used: 1 })) onChange(); }}
                      className="text-[11px] text-aurelius-text/50 hover:text-aurelius-text/80 disabled:opacity-40"
                      title="You used this angle once. Counting uses is what makes your own results outrank the research."
                    >
                      used it
                    </button>
                    <button
                      disabled={busy}
                      onClick={async () => { if (await post({ kind: "outcome", angleId: a.id, replies: 1 })) onChange(); }}
                      className="text-[11px] text-emerald-400/70 hover:text-emerald-300 disabled:opacity-40"
                    >
                      got a reply
                    </button>
                  </div>
                </div>
                <div className="text-right text-[11px] shrink-0">
                  <div className="text-aurelius-text/70">{a.verdict}</div>
                  <div className={a.grounding === "external" ? "text-emerald-400/70" : a.grounding === "internal" ? "text-aurelius-gold/60" : "text-amber-300/70"}>
                    {a.grounding === "external" ? "research-backed" : a.grounding === "internal" ? "from your own data" : "unverified guess"}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {draft && (
        <div className="mt-4 rounded-[2px] border border-aurelius-gold/25 bg-black/50 p-3">
          <div className="flex justify-between items-baseline gap-4 mb-2">
            <div className="text-[10px] uppercase tracking-[0.2em] text-aurelius-gold/50" style={bodyFont}>{draft.angle}</div>
            <button onClick={() => setDraft(null)} className="text-[11px] text-aurelius-text/60 hover:text-aurelius-text/70">close</button>
          </div>
          <pre className="whitespace-pre-wrap text-sm text-aurelius-text/85 font-sans leading-relaxed">{draft.body}</pre>
          <p className="text-[10px] mt-3" style={{ color: "var(--attn)" }}>{draft.trust}</p>
          {/* Copy you generate and don't keep is copy you never wrote. This
              button is the difference between a text generator and a pipeline. */}
          <div className="flex items-center gap-3 mt-3">
            <button
              disabled={busy || kept}
              onClick={async () => {
                setBusy(true); setErr(null);
                try {
                  const res = await fetch("/api/crm/content", {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      kind: "keep", body: draft.body, angleId: draft.angleId, format: draft.format,
                      title: draft.angle,
                      channel: draft.format.startsWith("instagram") ? "instagram" : draft.format === "email" ? "email" : "other",
                    }),
                  });
                  const j = await res.json();
                  if (!res.ok) throw new Error(j?.error ?? "Could not keep it");
                  setKept(true); onChange();
                } catch (e: any) { setErr(e?.message ?? String(e)); }
                finally { setBusy(false); }
              }}
              className={btn}
            >
              {kept ? "Kept ✓" : "Keep it"}
            </button>
            <span className="text-[10px] text-aurelius-text/60">
              A draft, nowhere else. Posting and sending are outward and stop for your confirm.
            </span>
          </div>
        </div>
      )}
    </section>
  );
}

/**
 * THE CONTENT QUEUE — writing that survives the tab closing.
 *
 * Cole edits in place, because the version that goes out should be his words,
 * not Aurelius's. Publishing is outward: the button stages a proposal on the
 * Bridge and nothing leaves until he taps Confirm.
 */
function ContentQueue({ drafts, state, onChange }: { drafts: ContentDraft[]; state?: ContentState; onChange: () => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [images, setImages] = useState<Record<string, string>>({});
  // The cadence truth — "nothing published in N days" when the feed has gone
  // quiet; silent when there's nothing worth saying. Fetched from the content
  // route so it stays the backend's honest sentence, not a UI recomputation.
  const [cadence, setCadence] = useState<Cadence | null>(null);
  const [planNote, setPlanNote] = useState<string | null>(null);

  const loadCadence = useCallback(async () => {
    try {
      const res = await fetch("/api/crm/content");
      if (res.ok) setCadence((await res.json())?.cadence ?? null);
    } catch { /* the cadence line is additive */ }
  }, []);
  useEffect(() => { loadCadence(); }, [loadCadence]);

  const live = drafts.filter((d) => d.status !== "discarded");

  async function post(body: Record<string, unknown>) {
    setBusy(true); setErr(null);
    try {
      const res = await fetch("/api/crm/content", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error ?? "Failed");
      onChange();
      return j;
    } catch (e: any) { setErr(e?.message ?? String(e)); return null; }
    finally { setBusy(false); }
  }

  return (
    <section className="au-card p-4">
      <div className="flex justify-between items-baseline gap-4 mb-2 flex-wrap">
        <SectionLabel row>What you&apos;ve written</SectionLabel>
        <Btn
          ghost
          disabled={busy}
          onClick={async () => {
            const j = await post({ kind: "plan_slots" });
            if (j) { setPlanNote(j.note ?? `${j.assigned} slotted.`); loadCadence(); }
          }}
          title="Assigns Mon/Thu 9am slots to ready drafts that lack one. A slot is a plan — publishing still stops for your confirm."
        >
          {busy ? "Working…" : "Plan the week's slots"}
        </Btn>
      </div>
      {/* A full queue is not output. The headline refuses to let a pile of
          unpublished drafts read as progress. */}
      <p className="text-xs text-aurelius-text/60 mb-3">{state?.headline ?? "Loading…"}</p>
      {/* The cadence truth — spoken only when the feed has gone quiet. */}
      {cadence?.line && (
        <p className="text-[11px] mb-3" style={{ color: "var(--attn)" }}>{cadence.line}</p>
      )}
      {planNote && (
        <p className="text-[11px] mb-3 text-emerald-200/80">{planNote}</p>
      )}
      {err && <div className="rounded-[2px] border border-red-500/40 bg-red-950/20 p-2 text-xs text-red-200 mb-3">{err}</div>}

      {live.length === 0 ? (
        <p className="text-xs text-aurelius-text/50 leading-relaxed">
          Write something from an angle above and hit <span className="text-aurelius-gold/70">Keep it</span> — it lands here,
          where you can edit it into your own words and publish when you&apos;re happy.
        </p>
      ) : (
        <ul className="divide-y divide-aurelius-gold/10">
          {live.map((d) => (
            <li key={d.id} className="py-2">
              <button onClick={() => setOpen(open === d.id ? null : d.id)} className="w-full text-left flex justify-between items-start gap-4">
                <div className="min-w-0">
                  <div className="text-sm text-aurelius-text/90 truncate">{d.title ?? d.body.slice(0, 60)}</div>
                  <div className="au-kicker" style={{ fontSize: 13 }}>
                    {[d.channel, d.format?.replace(/_/g, " "), d.angle ? `from "${d.angle.title}"` : null].filter(Boolean).join(" · ")}
                  </div>
                </div>
                <div className="text-right text-[11px] shrink-0">
                  <div style={{
                    color: d.status === "published" ? "var(--money)"
                      : d.status === "staged" ? "var(--attn)"
                      : d.status === "ready" ? "var(--gold)"
                      : "var(--ink3)",
                  }}>
                    {d.status === "staged" ? "waiting on your confirm" : d.status}
                  </div>
                  {d.grounding === "none" && <div className="text-amber-300/60">unverified idea</div>}
                </div>
              </button>

              {open === d.id && (
                <div className="mt-2 space-y-2">
                  {d.status === "published" ? (
                    <>
                      <pre className="whitespace-pre-wrap text-sm text-aurelius-text/80 font-sans leading-relaxed">{d.body}</pre>
                      {d.permalink && (
                        <a href={d.permalink} target="_blank" rel="noreferrer" className="text-[11px] text-aurelius-gold/70 hover:text-aurelius-gold">
                          view it →
                        </a>
                      )}
                    </>
                  ) : (
                    <>
                      {/* Editable, because the published version should be his. */}
                      <textarea
                        value={edits[d.id] ?? d.body}
                        onChange={(e) => setEdits({ ...edits, [d.id]: e.target.value })}
                        rows={7}
                        className="w-full bg-black/50 border border-aurelius-gold/30 rounded-[2px] px-3 py-2 text-sm text-aurelius-text leading-relaxed"
                      />
                      <div className="flex flex-wrap gap-2 items-center">
                        <Btn
                          ghost
                          disabled={busy || (edits[d.id] ?? d.body) === d.body}
                          onClick={() => post({ kind: "edit", draftId: d.id, body: edits[d.id] })}
                        >
                          Save my version
                        </Btn>
                        {d.status === "draft" && (
                          <Btn ghost disabled={busy} onClick={() => post({ kind: "edit", draftId: d.id, status: "ready" })}>
                            Mark ready
                          </Btn>
                        )}
                        {d.channel === "instagram" && (
                          <input
                            value={images[d.id] ?? d.imageUrl ?? ""}
                            onChange={(e) => setImages({ ...images, [d.id]: e.target.value })}
                            onBlur={() => images[d.id] !== undefined && post({ kind: "edit", draftId: d.id, imageUrl: images[d.id] })}
                            placeholder="public image URL"
                            className="bg-black/50 border border-aurelius-gold/30 rounded-[2px] px-2 py-1.5 text-xs text-aurelius-text placeholder:text-aurelius-text/30 flex-1 min-w-[12rem]"
                            title="Instagram fetches the image itself, so it has to be a public URL — an upload won't work."
                          />
                        )}
                        {d.status !== "staged" && (
                          <Btn
                            ghost
                            disabled={busy}
                            onClick={() => post({ kind: "publish", draftId: d.id })}
                            title="Stages it on Decisions for your confirm. Nothing goes out until you tap."
                          >
                            Publish…
                          </Btn>
                        )}
                        <button
                          disabled={busy}
                          onClick={() => post({ kind: "discard", draftId: d.id })}
                          className="text-[11px] text-aurelius-text/60 hover:text-red-300 disabled:opacity-40"
                        >
                          discard
                        </button>
                      </div>
                      {/* The link that closes the loop. Without a ref in the
                          post, a lead who arrives from it is untraceable and
                          the angle never gets credit — which is the whole
                          reason his own results can outrank generic research. */}
                      <div className="text-[10px] text-aurelius-text/50">
                        Put this link in the post so the lead traces back to this idea:{" "}
                        <code
                          className="text-aurelius-gold/70 cursor-pointer"
                          onClick={() => navigator.clipboard?.writeText(`${window.location.origin}/start?ref=${d.id.slice(0, 8)}`)}
                          title="click to copy"
                        >
                          /start?ref={d.id.slice(0, 8)}
                        </code>
                      </div>
                      {d.status === "staged" && (
                        <p className="text-[10px]" style={{ color: "var(--attn)" }}>
                          Waiting on Decisions for your confirm. Nothing has gone out.
                        </p>
                      )}
                    </>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// RETENTION — the PR ledger, check-in cadence, referrals, and the inward
// drafts (proof content, check-in / re-sign / referral message). Dormant-honest:
// with no PRs it says so; every draft is copy for Cole to review and send.
type RetentionMetric = { id: string; label: string; value: number; unit: string | null; isPR: boolean; achievedAt: string };
type RetentionView = {
  name: string; isMinor: boolean; checkInEveryDays: number | null; nextCheckInAt: string | null;
  metrics: RetentionMetric[]; prCount: number;
  referrals: { id: string; reason: string; status: string; createdAt: string }[];
};
function RetentionSection({ clientId, onChange }: { clientId: string; onChange: () => void }) {
  const [view, setView] = useState<RetentionView | null>(null);
  const [busy, setBusy] = useState(false);
  const [drafted, setDrafted] = useState<{ kind: string; body: string } | null>(null);
  const [mLabel, setMLabel] = useState("");
  const [mValue, setMValue] = useState("");
  const [mUnit, setMUnit] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/crm/retention?clientId=${clientId}`);
      if (res.ok) setView(await res.json());
    } catch { /* retention is a bonus panel */ }
  }, [clientId]);
  useEffect(() => { load(); }, [load]);

  async function act(body: Record<string, unknown>) {
    setBusy(true); setErr(null); setDrafted(null);
    try {
      const res = await fetch("/api/crm/retention", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, clientId }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error ?? "Failed");
      if (j.body) setDrafted({ kind: String(body.kind), body: j.body });
      await load(); onChange();
    } catch (e: any) { setErr(e?.message ?? String(e)); }
    finally { setBusy(false); }
  }

  const field = "bg-black/50 border border-aurelius-gold/30 rounded-[2px] px-2 py-1.5 text-sm text-aurelius-text placeholder:text-aurelius-text/30";
  const btn = "px-2.5 py-1 rounded-[2px] border border-aurelius-gold/50 text-aurelius-gold text-[11px] hover:bg-aurelius-gold/10 disabled:opacity-40";

  return (
    <div className="rounded-[2px] border border-aurelius-gold/15 bg-black/30 p-3 space-y-3">
      <div className="flex items-baseline justify-between">
        <span className="uppercase tracking-[0.2em] text-aurelius-gold/50 text-[11px]" style={bodyFont}>Retention</span>
        {view && <span className="text-[11px] text-neutral-500">{view.prCount} PR{view.prCount === 1 ? "" : "s"}{view.nextCheckInAt ? ` · next check-in ${day(view.nextCheckInAt)}` : ""}</span>}
      </div>
      {err && <div className="rounded-[2px] border border-red-500/40 bg-red-950/20 p-2 text-[11px] text-red-200">{err}</div>}

      {/* PR ledger */}
      {view && view.metrics.length > 0 && (
        <ul className="text-[11px] space-y-0.5">
          {view.metrics.slice(0, 6).map((m) => (
            <li key={m.id} className={m.isPR ? "text-aurelius-gold" : "text-neutral-400"}>
              {m.isPR ? "★ " : ""}{m.label}: {m.value}{m.unit ?? ""} <span className="text-neutral-600">· {day(m.achievedAt)}</span>
            </li>
          ))}
        </ul>
      )}

      {/* Log a number */}
      <div className="flex flex-wrap gap-2 items-center">
        <input value={mLabel} onChange={(e) => setMLabel(e.target.value)} placeholder="metric (e.g. vertical)" className={`${field} w-36`} />
        <input value={mValue} onChange={(e) => setMValue(e.target.value)} placeholder="value" inputMode="decimal" className={`${field} w-20`} />
        <input value={mUnit} onChange={(e) => setMUnit(e.target.value)} placeholder="unit" className={`${field} w-16`} />
        <button disabled={busy || !mLabel.trim() || !mValue.trim()} onClick={() => { act({ kind: "metric", label: mLabel, value: Number(mValue), unit: mUnit }); setMLabel(""); setMValue(""); setMUnit(""); }} className={btn}>Log a PR</button>
      </div>

      {/* Inward drafts */}
      <div className="flex flex-wrap gap-2">
        <button disabled={busy} onClick={() => act({ kind: "checkin" })} className={btn}>Draft check-in</button>
        <button disabled={busy} onClick={() => act({ kind: "resign" })} className={btn}>Draft re-sign</button>
        <button disabled={busy} onClick={() => act({ kind: "referral" })} className={btn}>Draft referral ask</button>
        <button disabled={busy} onClick={() => act({ kind: "proof" })} className={btn}>Draft proof post</button>
      </div>
      {drafted && (
        <div className="rounded-[2px] border border-aurelius-gold/25 bg-black/50 p-2.5">
          <div className="text-[10px] uppercase tracking-wider text-aurelius-gold/50 mb-1" style={bodyFont}>{drafted.kind} draft — your words, your send</div>
          <p className="text-xs text-aurelius-text/85 whitespace-pre-line">{drafted.body}</p>
        </div>
      )}
    </div>
  );
}

// GROWTH — the config-gated engines: payment/SMS connect state, the partnership
// pipeline, and the paid-boost experiment. Honest about what's not connected.
type Growth = {
  integrations: { stripe: boolean; twilio: boolean; paidAds: boolean };
  boost: { active: boolean; spentCents: number; leads: number; cplCents: number | null; verdict: string };
  analytics: { ready: boolean; note: string };
};
function GrowthPanel() {
  const [g, setG] = useState<Growth | null>(null);
  const [busy, setBusy] = useState(false);
  const [partnerName, setPartnerName] = useState("");
  const [out, setOut] = useState<{ label: string; text: string; ref?: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { const r = await fetch("/api/crm/growth"); if (r.ok) setG(await r.json()); } catch { /* bonus panel */ }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function act(body: Record<string, unknown>, label: string) {
    setBusy(true); setErr(null); setOut(null);
    try {
      const r = await fetch("/api/crm/growth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error ?? "Failed");
      if (j.suggestions) setOut({ label, text: j.suggestions });
      else if (j.body) setOut({ label, text: j.body, ref: j.refUrl });
      else if (j.reason) setOut({ label, text: j.reason });
      await load();
    } catch (e: any) { setErr(e?.message ?? String(e)); }
    finally { setBusy(false); }
  }

  const dot = (on: boolean) => (on ? { color: "var(--money)" } : { color: "var(--ink3)" });

  return (
    <section className="au-card p-4 space-y-4">
      <SectionLabel row>Growth engines</SectionLabel>

      {/* Connect state — honest about what's dormant */}
      {g && (
        <div className="flex flex-wrap gap-4 text-xs">
          <span style={dot(g.integrations.stripe)}>● Stripe {g.integrations.stripe ? "connected" : "— set STRIPE_WEBHOOK_SECRET"}</span>
          <span style={dot(g.integrations.twilio)}>● Twilio {g.integrations.twilio ? "connected" : "— set TWILIO_* + 10DLC"}</span>
          <span style={dot(g.integrations.paidAds)}>● Meta ads {g.integrations.paidAds ? "connected" : "— set META_ADS_TOKEN"}</span>
        </div>
      )}
      <p className="au-kicker" style={{ display: "block", fontSize: 12.5 }}>
        Payments self-record once Stripe/Venmo/Zelle land; an unmatched one becomes a notice on Decisions. Inbound texts self-record too — sending stays your tap.
      </p>

      {err && <div className="rounded-[2px] border border-red-500/40 bg-red-950/20 p-2 text-xs text-red-200">{err}</div>}

      {/* Partnership */}
      <div className="space-y-2">
        <div className="text-[11px] uppercase tracking-wider text-aurelius-gold/50" style={bodyFont}>Partnerships (find the next one)</div>
        <div className="flex flex-wrap gap-2 items-center">
          <Btn ghost disabled={busy} onClick={() => act({ kind: "research_partners" }, "Partner types to pursue")}>Research partners</Btn>
          <input value={partnerName} onChange={(e) => setPartnerName(e.target.value)} placeholder="a specific partner…" className="bg-black/50 border border-aurelius-gold/30 rounded-[2px] px-2 py-1.5 text-sm text-aurelius-text w-44 placeholder:text-aurelius-text/30" />
          <Btn ghost disabled={busy || !partnerName.trim()} onClick={() => act({ kind: "partner_intro", name: partnerName }, `Intro to ${partnerName}`)}>Draft intro</Btn>
        </div>
      </div>

      {/* Paid boost */}
      <div className="space-y-2">
        <div className="text-[11px] uppercase tracking-wider text-aurelius-gold/50" style={bodyFont}>Paid boost (only behind proof)</div>
        <div className="flex flex-wrap gap-2">
          <Btn ghost disabled={busy} onClick={() => act({ kind: "propose_boost" }, "Boost proposal")}>Propose a boost</Btn>
          {/* Stage the spend → files a pending confirm on Decisions. Spend is always your tap. */}
          <Btn ghost disabled={busy} onClick={() => act({ kind: "stage_boost" }, "Boost staged — confirm on Decisions")}>Stage the spend →</Btn>
        </div>
        {g?.boost?.active && (
          <p className="text-xs" style={g.boost.cplCents != null && g.boost.verdict.includes("kill") ? { color: "var(--danger)" } : { color: "var(--ink2)" }}>
            Spent ${(g.boost.spentCents / 100).toFixed(2)} · {g.boost.leads} lead{g.boost.leads === 1 ? "" : "s"} · {g.boost.verdict}
          </p>
        )}
      </div>

      {out && (
        <div className="rounded-[2px] border border-aurelius-gold/25 bg-black/50 p-2.5">
          <div className="text-[10px] uppercase tracking-wider text-aurelius-gold/50 mb-1" style={bodyFont}>{out.label}</div>
          <p className="text-xs text-aurelius-text/85 whitespace-pre-line">{out.text}</p>
          {out.ref && <p className="text-[11px] text-aurelius-gold/70 mt-1">Tracked ref: {out.ref}</p>}
        </div>
      )}
    </section>
  );
}

/**
 * THE WARM LIST — the only channel that works at zero audience.
 *
 * Cole has no inbound. A funnel needs traffic he doesn't have; a warm list
 * needs a text box. So this is deliberately the lowest-friction thing on the
 * page: paste names, one per line, optionally `Name, email, how you know them`.
 * Everything is optional except a name, because a list you have to format is a
 * list that never gets pasted.
 */
function WarmList({ onChange, empty }: { onChange: () => void; empty: boolean }) {
  const [open, setOpen] = useState(empty);
  const [raw, setRaw] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  // "Jake Miller, dana@x.com, mum coached with me" → structured, forgivingly.
  const parsed = raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(",").map((p) => p.trim());
      const email = parts.find((p) => /\S+@\S+\.\S+/.test(p));
      const name = parts[0] ?? "";
      const context = parts.filter((p) => p !== name && p !== email).join(", ") || undefined;
      return { name, email, context };
    })
    .filter((e) => e.name.length > 1);

  async function post(body: Record<string, unknown>) {
    setBusy(true); setErr(null); setResult(null);
    try {
      const res = await fetch("/api/crm/leads/draft", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error ?? "Failed");
      return j;
    } catch (e: any) { setErr(e?.message ?? String(e)); return null; }
    finally { setBusy(false); }
  }

  return (
    <section className="au-card p-4">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex justify-between items-center text-left"
      >
        <SectionLabel row>The warm list</SectionLabel>
        <span className="au-kicker" style={{ fontSize: 12.5 }}>{open ? "hide" : "open"}</span>
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          <p className="text-xs text-aurelius-text/60 leading-relaxed">
            The ten people you could message this week who might say yes — or who know someone who would.
            Old athletes, their parents, coaches you know. One per line. Add an email and how you know them
            if you have it: <span className="text-aurelius-text/60">Jake Miller, dana@example.com, trained him two years</span>
          </p>
          <textarea
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            rows={6}
            placeholder={"Jake Miller, dana@example.com, trained him two years\nSarah Chen, coached her sister\nCoach Davis, sends me athletes"}
            className="w-full bg-black/50 border border-aurelius-gold/30 rounded-[2px] px-3 py-2 text-sm text-aurelius-text placeholder:text-aurelius-text/25 font-mono"
          />
          {err && <div className="rounded-[2px] border border-red-500/40 bg-red-950/20 p-2 text-xs text-red-200">{err}</div>}
          {result && <div className="rounded-[2px] border border-emerald-500/40 bg-emerald-950/20 p-2 text-xs text-emerald-200">{result}</div>}
          <div className="flex flex-wrap gap-2 items-center">
            {/* The one primary of this section — the shortest path at zero. */}
            <Btn
              disabled={busy || parsed.length === 0}
              onClick={async () => {
                const j = await post({ kind: "warm_list", entries: parsed });
                if (j) { setResult(`${j.created} added${j.skipped ? `, ${j.skipped} already known` : ""}. Each has a follow-up due today.`); setRaw(""); onChange(); }
              }}
            >
              {busy ? "Adding…" : `Add ${parsed.length || ""} to the pipeline`}
            </Btn>
            <Btn
              ghost
              disabled={busy}
              onClick={async () => {
                const j = await post({ kind: "sweep" });
                if (j) {
                  setResult(
                    j.due === 0
                      ? "Nothing due — every open lead already has a future follow-up date."
                      : `${j.due} due · ${j.drafted + j.gated} drafted${j.gated ? ` (${j.gated} waiting on your confirm)` : ""}. Nothing was sent.`
                  );
                  onChange();
                }
              }}
              title="Drafts messages for every lead whose follow-up is due. Writes Gmail drafts only."
            >
              Draft what&apos;s due
            </Btn>
          </div>
          <p className="text-[10px] text-aurelius-text/60">
            Drafts land in your Gmail drafts for you to read and send. Aurelius never messages anyone on its own.
          </p>
        </div>
      )}
    </section>
  );
}
