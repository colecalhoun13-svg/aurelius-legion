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

import { useCallback, useEffect, useState } from "react";

type Snapshot = {
  empty: boolean;
  headline: string;
  pipeline: Record<string, number>;
  openLeads: number;
  activeClients: number;
  engagementsByShape: { monthly: number; block: number; program: number };
  mrr: string;
  receivedThisMonth: string;
  receivedAllTime: string;
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

const money = (cents: number) => `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—");

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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [openClient, setOpenClient] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [sport, setSport] = useState("");
  const [source, setSource] = useState<string>("referral");
  const [referredBy, setReferredBy] = useState("");
  const [nextAction, setNextAction] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/crm");
      if (!res.ok) return setLoadFailed(true);
      setData(await res.json());
      setLoadFailed(false);
    } catch {
      setLoadFailed(true);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

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
    try {
      await fetch("/api/crm/leads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status, lastContactAt: new Date().toISOString() }),
      });
      await load();
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
      await load();
    } catch (err: any) {
      setError(err?.message ?? String(err));
    } finally { setBusy(false); }
  }

  if (loadFailed) {
    return (
      <div className="p-6">
        <h1 className="aurelius-heading text-2xl text-aurelius-gold mb-3">Business</h1>
        <div className="rounded border border-red-500/40 bg-red-950/20 p-4 text-sm text-red-200">
          Couldn&apos;t load the business. This is a loading failure, not an empty pipeline — your data is fine.
          <button onClick={load} className="ml-3 underline hover:text-red-100">Retry</button>
        </div>
      </div>
    );
  }

  if (!data) return <div className="p-6 text-aurelius-text/50">Loading…</div>;

  const { pipeline: snap, attention, clients, leads, marketing, offers, offerState, drafts, contentState, ledger, probe, trackLinks, analyst } = data;
  const openLeads = leads.filter((l) => !["won", "lost"].includes(l.status));
  const attentionCount =
    attention.blocksEnding.length + attention.renewalsDue.length + attention.followUpsOverdue.length + attention.unpaid.length;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <header>
        <h1 className="aurelius-heading text-2xl text-aurelius-gold">Business</h1>
        <p className="text-xs text-aurelius-text/50 mt-1">
          The remote coaching business you own. Athletes at the gym aren&apos;t here — those are your employer&apos;s.
        </p>
        {/* The front door, from the inside. /start is public and outside the
            app lock — this is how Cole finds it, checks what a stranger sees,
            and grabs the link to put anywhere. */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
          <a href="/start" target="_blank" rel="noreferrer" className="text-[11px] text-aurelius-gold/60 hover:text-aurelius-gold inline-block">
            your front door (/start) — where prospects land →
          </a>
          <a href="/standard" target="_blank" rel="noreferrer" className="text-[11px] text-aurelius-gold/60 hover:text-aurelius-gold inline-block">
            the assessment (/standard) — the lead magnet →
          </a>
        </div>
      </header>

      {error && (
        <div className="rounded border border-red-500/40 bg-red-950/20 p-3 text-sm text-red-200">{error}</div>
      )}

      {/* THE ANALYST — one confronting truth about the funnel. Names the leak
          before the win; refuses to crown a winner on too little data. */}
      {analyst && (
        <section className="rounded border border-aurelius-gold/30 bg-black/40 p-4">
          <div className="aurelius-heading text-[11px] uppercase tracking-[0.2em] text-aurelius-gold/70 mb-2">The read</div>
          <p className="text-sm text-aurelius-text/90 leading-relaxed">{analyst.truth}</p>
          {analyst.ranked.length > 0 && (
            <ul className="mt-3 text-xs space-y-1">
              {analyst.ranked.map((c) => (
                <li key={c.channel} className="flex justify-between gap-3 text-neutral-400">
                  <span className="text-neutral-300">{c.channel}</span>
                  <span>
                    {c.clicks} click{c.clicks === 1 ? "" : "s"} · {c.leads} lead{c.leads === 1 ? "" : "s"}
                    {c.conversionPct != null ? ` · ${c.conversionPct}% conv` : ""}
                    {c.earnedCents > 0 ? ` · ${money(c.earnedCents)}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {analyst.tooEarly.length > 0 && (
            <p className="mt-2 text-[11px] text-neutral-600">
              Too early to rank: {analyst.tooEarly.map((c) => c.channel).join(", ")} — not enough data yet.
            </p>
          )}
        </section>
      )}

      {/* ── The honest headline ──────────────────────────────────── */}
      {snap.empty ? (
        <section className="rounded border border-amber-500/40 bg-amber-950/10 p-5">
          <div className="aurelius-heading text-amber-300 text-sm uppercase tracking-[0.2em] mb-2">
            The pipeline is empty
          </div>
          <p className="text-aurelius-text/90 leading-relaxed">
            No clients, no open leads. The constraint isn&apos;t tracking — it&apos;s that nothing arrives on its own.
            This roster can&apos;t help you until there&apos;s someone in it, and building more machinery won&apos;t
            change that.
          </p>
          <p className="text-aurelius-text/70 mt-3 text-sm leading-relaxed">
            The shortest path from here is the warm list: the ten people you could message this week who might say
            yes, or who know someone who would. Old athletes, their parents, coaches you know. Add the first one below.
          </p>
        </section>
      ) : (
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="Active clients" value={String(snap.activeClients)} />
          <Stat label="Open leads" value={String(snap.openLeads)} />
          <Stat label="Committed / mo" value={snap.mrr} hint={`${snap.engagementsByShape.monthly} monthly`} />
          <Stat
            label="Received this month"
            value={snap.receivedThisMonth}
            hint={snap.outstandingCents > 0 ? `${snap.outstanding} outstanding` : undefined}
            alert={snap.overdueCount > 0}
          />
        </section>
      )}

      {/* ── The money ledger: earned money, traced to what earned it ─ */}
      {ledger && ledger.earnedCents > 0 && (
        <section className="rounded border border-emerald-500/30 bg-black/40 p-4">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="aurelius-heading text-sm uppercase tracking-[0.2em] text-emerald-300/80">Earned</h2>
            <span className="text-xs text-neutral-500">
              {ledger.paymentCount} payment{ledger.paymentCount === 1 ? "" : "s"}
              {ledger.selfRecordedCents > 0 ? ` · ${money(ledger.selfRecordedCents)} self-recorded` : ""}
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <Stat label="Earned all-time" value={ledger.earned} />
            <Stat label="Earned this month" value={ledger.earnedThisMonth} />
            {ledger.byChannel[0] && ledger.byChannel[0].channel !== "unattributed" && (
              <Stat label="Top channel" value={ledger.byChannel[0].channel} hint={ledger.byChannel[0].label} />
            )}
          </div>
          {ledger.byChannel.length > 0 && (
            <div className="mt-3 text-xs text-neutral-400 space-y-1">
              <div className="uppercase tracking-wider text-neutral-600">Earned by channel</div>
              {ledger.byChannel.map((c) => (
                <div key={c.channel} className="flex justify-between gap-4">
                  <span>{c.channel}</span>
                  <span className="text-emerald-300/80">{c.label}</span>
                </div>
              ))}
            </div>
          )}
          {ledger.byAngle.length > 0 && (
            <div className="mt-3 text-xs text-neutral-400 space-y-1">
              <div className="uppercase tracking-wider text-neutral-600">Earned by angle</div>
              {ledger.byAngle.map((a) => (
                <div key={a.angle} className="flex justify-between gap-4">
                  <span className="truncate">{a.angle}</span>
                  <span className="text-emerald-300/80 shrink-0">{a.label}</span>
                </div>
              ))}
            </div>
          )}
          <p className="mt-3 text-[11px] text-neutral-600">
            Earned is money that actually arrived — the sum of payments, never a projection. Committed/mo above is what recurs; this is what landed.
          </p>
        </section>
      )}

      {/* ── Tracked links: the emit side of attribution, click-counted ─ */}
      {trackLinks && trackLinks.length > 0 && (
        <section className="rounded border border-aurelius-gold/20 bg-black/30 p-4">
          <div className="flex items-baseline justify-between mb-2">
            <h2 className="aurelius-heading text-sm uppercase tracking-[0.2em] text-aurelius-gold/80">Your links</h2>
            <span className="text-[11px] text-neutral-500">clicks → leads, per link</span>
          </div>
          <ul className="space-y-1.5 text-xs">
            {trackLinks.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-3">
                <span className="flex-1 min-w-0 truncate text-neutral-300">
                  <span className="text-neutral-600">{l.channel}</span>
                  {l.label ? <span> · {l.label}</span> : null}
                  <span className="text-neutral-600"> · /l/{l.code}</span>
                </span>
                <span className="text-neutral-500 shrink-0">
                  {l.clickCount} click{l.clickCount === 1 ? "" : "s"} · {l._count.leads} lead{l._count.leads === 1 ? "" : "s"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── What costs money if ignored ──────────────────────────── */}
      {attentionCount > 0 && (
        <section className="rounded border border-aurelius-gold/30 bg-black/40 p-4">
          <h2 className="aurelius-heading text-sm uppercase tracking-[0.2em] text-aurelius-gold/80 mb-3">
            Needs you
          </h2>
          <ul className="space-y-2 text-sm">
            {attention.blocksEnding.map((b) => (
              <li key={b.engagementId} className="flex justify-between gap-4 text-aurelius-text/90">
                <span><strong className="text-aurelius-gold/90">{b.client}</strong> — {b.title} ends {day(b.endsAt)}. Re-sign conversation is now.</span>
              </li>
            ))}
            {attention.renewalsDue.map((r) => (
              <li key={r.engagementId} className="flex justify-between gap-4 text-aurelius-text/90">
                <span><strong className="text-aurelius-gold/90">{r.client}</strong> — {r.amount} renews {day(r.nextBillingAt)}.</span>
              </li>
            ))}
            {attention.followUpsOverdue.map((f) => (
              <li key={f.leadId} className="flex justify-between gap-4 text-amber-200/90">
                <span><strong>{f.name}</strong> — {f.action ?? "follow up"} was due {day(f.dueAt)}.</span>
              </li>
            ))}
            {attention.unpaid.map((u) => (
              <li key={u.id} className={`flex justify-between gap-4 ${u.overdue ? "text-red-300" : "text-aurelius-text/90"}`}>
                <span>
                  <strong>{u.client}</strong> owes {money(u.outstandingCents)}
                  {u.description ? ` — ${u.description}` : ""}{u.overdue ? " (overdue)" : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* The funnel, in order: what you sell → what you say → who you say it
          to → who's in → who's paying. Each section stays on screen when it's
          empty, because an empty one is the instruction. */}

      {/* ── 1. What you sell ─────────────────────────────────────── */}
      <OfferPanel offers={offers ?? []} state={offerState} probe={probe} onChange={load} />

      {/* ── 2. What you say ──────────────────────────────────────── */}
      <MarketingPanel marketing={marketing} hasOffer={offerState?.hasActive ?? false} onChange={load} />

      {/* ── 3. What you've written, and whether any of it went out ─ */}
      <ContentQueue drafts={drafts ?? []} state={contentState} onChange={load} />

      {/* ── 4. The warm list ─────────────────────────────────────── */}
      <WarmList onChange={load} empty={snap.empty} />

      {/* ── Add a lead ───────────────────────────────────────────── */}
      <section className="rounded border border-aurelius-gold/20 bg-black/30 p-4">
        <h2 className="aurelius-heading text-sm uppercase tracking-[0.2em] text-aurelius-gold/80 mb-3">
          Add someone
        </h2>
        <form onSubmit={addLead} className="grid grid-cols-1 md:grid-cols-5 gap-2">
          <input
            value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" required
            className="md:col-span-1 bg-black/50 border border-aurelius-gold/30 rounded px-3 py-2 text-sm text-aurelius-text placeholder:text-aurelius-text/30"
          />
          <input
            value={sport} onChange={(e) => setSport(e.target.value)} placeholder="Sport"
            className="bg-black/50 border border-aurelius-gold/30 rounded px-3 py-2 text-sm text-aurelius-text placeholder:text-aurelius-text/30"
          />
          <select
            value={source} onChange={(e) => setSource(e.target.value)}
            className="bg-black/50 border border-aurelius-gold/30 rounded px-3 py-2 text-sm text-aurelius-text"
          >
            {SOURCES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
          </select>
          <input
            value={referredBy} onChange={(e) => setReferredBy(e.target.value)} placeholder="Referred by"
            className="bg-black/50 border border-aurelius-gold/30 rounded px-3 py-2 text-sm text-aurelius-text placeholder:text-aurelius-text/30"
          />
          <input
            value={nextAction} onChange={(e) => setNextAction(e.target.value)} placeholder="Next action"
            className="bg-black/50 border border-aurelius-gold/30 rounded px-3 py-2 text-sm text-aurelius-text placeholder:text-aurelius-text/30"
          />
          <button
            type="submit" disabled={busy || !name.trim()}
            className="md:col-span-5 mt-1 py-2 rounded border border-aurelius-gold/50 text-aurelius-gold text-sm hover:bg-aurelius-gold/10 disabled:opacity-40"
          >
            {busy ? "Saving…" : "Add to pipeline"}
          </button>
        </form>
      </section>

      {/* ── Pipeline ─────────────────────────────────────────────── */}
      {openLeads.length > 0 && (
        <section className="rounded border border-aurelius-gold/20 bg-black/30 p-4">
          <h2 className="aurelius-heading text-sm uppercase tracking-[0.2em] text-aurelius-gold/80 mb-3">
            Pipeline · {openLeads.length}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            {STAGES.map((stage) => {
              const inStage = openLeads.filter((l) => l.status === stage);
              return (
                <div key={stage} className="min-h-[4rem]">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-aurelius-gold/50 mb-2">
                    {stage} · {inStage.length}
                  </div>
                  <div className="space-y-2">
                    {inStage.map((l) => (
                      <div key={l.id} className="rounded border border-aurelius-gold/20 bg-black/50 p-2 text-sm">
                        <div className="text-aurelius-text/90">{l.name}</div>
                        {(l.sport || l.referredBy) && (
                          <div className="text-[11px] text-aurelius-text/40">
                            {[l.sport, l.referredBy ? `via ${l.referredBy}` : null].filter(Boolean).join(" · ")}
                          </div>
                        )}
                        {l.nextAction && (
                          <div className="text-[11px] text-amber-200/70 mt-1">→ {l.nextAction}</div>
                        )}
                        <div className="flex gap-2 mt-2">
                          {STAGES.indexOf(stage) < STAGES.length - 1 && (
                            <button
                              onClick={() => moveLead(l.id, STAGES[STAGES.indexOf(stage) + 1]!)}
                              disabled={busy}
                              className="text-[11px] text-aurelius-gold/70 hover:text-aurelius-gold disabled:opacity-40"
                            >
                              advance
                            </button>
                          )}
                          <button
                            onClick={() => convert(l.id)} disabled={busy}
                            className="text-[11px] text-emerald-400/80 hover:text-emerald-300 disabled:opacity-40"
                          >
                            signed
                          </button>
                          <button
                            onClick={async () => {
                              setBusy(true); setError(null);
                              try {
                                const res = await fetch("/api/crm/leads/draft", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ kind: "draft", leadId: l.id }),
                                });
                                const j = await res.json();
                                if (!res.ok) throw new Error(j?.error ?? "Draft failed");
                                await load();
                              } catch (e: any) { setError(e?.message ?? String(e)); }
                              finally { setBusy(false); }
                            }}
                            disabled={busy}
                            className="text-[11px] text-aurelius-gold/70 hover:text-aurelius-gold disabled:opacity-40"
                            title="Researches them and drafts a message into your Gmail drafts. Never sends."
                          >
                            draft
                          </button>
                          <button
                            onClick={() => moveLead(l.id, "lost")} disabled={busy}
                            className="text-[11px] text-aurelius-text/40 hover:text-aurelius-text/70 disabled:opacity-40"
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
        </section>
      )}

      {/* ── Roster ───────────────────────────────────────────────── */}
      {clients.length > 0 && (
        <section className="rounded border border-aurelius-gold/20 bg-black/30 p-4">
          <h2 className="aurelius-heading text-sm uppercase tracking-[0.2em] text-aurelius-gold/80 mb-3">
            Roster · {clients.length}
          </h2>
          <ul className="divide-y divide-aurelius-gold/10">
            {clients.map((c) => (
              <li key={c.id} className="py-2">
                <button
                  onClick={() => setOpenClient(openClient === c.id ? null : c.id)}
                  className="w-full flex justify-between items-center gap-4 text-left hover:text-aurelius-gold"
                >
                  <div>
                    <div className="text-aurelius-text/90 text-sm">{c.name}</div>
                    <div className="text-[11px] text-aurelius-text/40">
                      {[c.sport, c.status !== "active" ? c.status : null].filter(Boolean).join(" · ") || "—"}
                    </div>
                  </div>
                  <div className="text-right text-[11px] text-aurelius-text/60">
                    {c.engagements.length === 0 ? (
                      // This label used to be a dead end — the page said an
                      // engagement was missing and gave no way to add one.
                      <span className="text-amber-300/70">no engagement recorded — tap to add</span>
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
    "bg-black/50 border border-aurelius-gold/30 rounded px-2 py-1.5 text-sm text-aurelius-text placeholder:text-aurelius-text/30";
  const btn =
    "px-3 py-1.5 rounded border border-aurelius-gold/50 text-aurelius-gold text-xs hover:bg-aurelius-gold/10 disabled:opacity-40";

  if (failed) {
    return (
      <div className="mt-3 rounded border border-red-500/40 bg-red-950/20 p-3 text-xs text-red-200">
        Couldn&apos;t load {name}&apos;s record — that&apos;s a loading failure, not an empty one.
        <button onClick={load} className="ml-2 underline">Retry</button>
      </div>
    );
  }

  return (
    <div className="mt-3 rounded border border-aurelius-gold/20 bg-black/50 p-3 space-y-4">
      {err && <div className="rounded border border-red-500/40 bg-red-950/20 p-2 text-xs text-red-200">{err}</div>}

      {detail && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[11px]">
          <div>
            <div className="uppercase tracking-[0.2em] text-aurelius-gold/50 mb-1">Engagements</div>
            {detail.engagements.length === 0 ? (
              <div className="text-aurelius-text/40">none</div>
            ) : (
              detail.engagements.map((e) => (
                <div key={e.id} className="text-aurelius-text/80">
                  {e.title} · {money(e.priceCents)}{e.shape === "monthly" ? "/mo" : ""}
                  {e.endsAt && <span className="text-amber-200/70"> · ends {day(e.endsAt)}</span>}
                  {e.nextBillingAt && <span className="text-aurelius-text/50"> · renews {day(e.nextBillingAt)}</span>}
                  {/* The re-sign conversation the risk line nags about now has
                      a button to end it — either outcome, one tap. */}
                  {e.status === "active" && (
                    <span className="ml-2">
                      <button
                        disabled={busy}
                        onClick={() => post({ kind: "engagement_patch", engagementId: e.id, status: "completed" })}
                        className="text-[10px] text-aurelius-text/40 hover:text-aurelius-text/70 disabled:opacity-40"
                      >
                        completed
                      </button>
                      <span className="text-aurelius-text/20"> · </span>
                      <button
                        disabled={busy}
                        onClick={() => post({ kind: "engagement_patch", engagementId: e.id, status: "cancelled" })}
                        className="text-[10px] text-aurelius-text/40 hover:text-red-300 disabled:opacity-40"
                      >
                        cancelled
                      </button>
                    </span>
                  )}
                  {e.status !== "active" && <span className="text-aurelius-text/40"> · {e.status}</span>}
                </div>
              ))
            )}
          </div>
          <div>
            <div className="uppercase tracking-[0.2em] text-aurelius-gold/50 mb-1">Owed</div>
            {detail.invoices.filter((i) => i.status !== "paid" && i.status !== "void").length === 0 ? (
              <div className="text-aurelius-text/40">nothing outstanding</div>
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
            <div className="uppercase tracking-[0.2em] text-aurelius-gold/50 mb-1">Received · {detail.lifetime} lifetime</div>
            {detail.payments.length === 0 ? (
              <div className="text-aurelius-text/40">nothing yet</div>
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
      <p className="text-[10px] text-aurelius-text/40">
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
          className="text-[11px] text-aurelius-text/40 hover:text-aurelius-text/70 disabled:opacity-40"
          onClick={() => post({ kind: "client_patch", status: "paused" })}
        >
          pause client
        </button>
        <button
          disabled={busy}
          className="text-[11px] text-aurelius-text/40 hover:text-aurelius-text/70 disabled:opacity-40"
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
 * real buyer.
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

  const btn = "px-3 py-1.5 rounded border border-aurelius-gold/50 text-aurelius-gold text-xs hover:bg-aurelius-gold/10 disabled:opacity-40";

  return (
    <section className={`rounded border p-4 ${state?.hasActive ? "border-aurelius-gold/20 bg-black/30" : "border-amber-500/40 bg-amber-950/10"}`}>
      <div className="flex justify-between items-baseline gap-4 mb-2">
        <h2 className="aurelius-heading text-sm uppercase tracking-[0.2em] text-aurelius-gold/80">What you sell</h2>
        <div className="flex gap-2">
          {!state?.hasActive && (
            <button
              disabled={busy}
              onClick={() => post({ kind: "probe" })}
              className={btn}
              title="Float 2–3 variants, each behind its own tracked link, and let real intake decide which promise lands."
            >
              {busy ? "Working…" : "Probe A/B"}
            </button>
          )}
          <button disabled={busy} onClick={() => post({ kind: "draft" })} className={btn}>
            {busy ? "Working…" : "Draft one"}
          </button>
        </div>
      </div>

      {/* THE PROBE — let the market pick the promise. Each variant carries its
          own tracked link; the one that pulls leads is the one to price. */}
      {probe && probe.variants.length > 0 && (
        <div className="rounded border border-sky-500/30 bg-sky-950/10 p-3 mb-3">
          <div className="flex items-baseline justify-between mb-2">
            <span className="aurelius-heading text-[11px] uppercase tracking-[0.2em] text-sky-300/80">Offer probe</span>
            <span className="text-[11px] text-neutral-500">{probe.note}</span>
          </div>
          <ul className="space-y-1.5">
            {probe.variants.map((v) => {
              const leading = probe.leader?.offerId === v.offerId;
              return (
                <li key={v.offerId} className={`flex items-center justify-between gap-3 text-xs ${leading ? "text-sky-200" : "text-neutral-300"}`}>
                  <span className="flex-1 min-w-0 truncate">
                    {leading && <span className="text-sky-400 mr-1">★</span>}
                    {v.name} <span className="text-neutral-600">· {v.shape}{v.status === "active" ? " · live" : ""}</span>
                  </span>
                  <span className="text-neutral-500 shrink-0">{v.leads} lead{v.leads === 1 ? "" : "s"} · {v.clicks} click{v.clicks === 1 ? "" : "s"}</span>
                  <button onClick={() => copyLink(v.code)} className="text-sky-300/80 hover:text-sky-200 shrink-0" title={linkFor(v.code)}>
                    {copied === v.code ? "copied" : "copy link"}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      <p className={`text-xs mb-3 leading-relaxed ${state?.hasActive ? "text-aurelius-text/60" : "text-amber-200/90"}`}>
        {state?.headline ?? "Loading…"}
      </p>
      {err && <div className="rounded border border-red-500/40 bg-red-950/20 p-2 text-xs text-red-200 mb-3">{err}</div>}

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
                    <span className="ml-2 text-[10px] uppercase tracking-wider text-aurelius-text/40">
                      {o.shape}{o.durationWeeks ? ` · ${o.durationWeeks}wk` : ""}
                    </span>
                  </div>
                  <div className="text-[11px] text-aurelius-text/40">{o.audience}</div>
                </div>
                <div className="text-right text-[11px] shrink-0">
                  <div className={o.status === "active" ? "text-emerald-400/80" : "text-amber-300/70"}>
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
                  {o.assumptions && <p className="text-amber-200/70"><span className="text-amber-300/80">Assumed · </span>{o.assumptions}</p>}

                  <div className="flex flex-wrap gap-2 items-center pt-1">
                    {o.status === "active" ? (
                      <button disabled={busy} onClick={() => post({ kind: "retire", offerId: o.id })}
                        className="text-[11px] text-aurelius-text/40 hover:text-aurelius-text/70 disabled:opacity-40">
                        stop selling this
                      </button>
                    ) : (
                      <>
                        <input
                          value={prices[o.id] ?? ""} onChange={(e) => setPrices({ ...prices, [o.id]: e.target.value })}
                          placeholder={o.shape === "monthly" ? "$ / month" : "$ total"} inputMode="decimal"
                          className="bg-black/50 border border-aurelius-gold/30 rounded px-2 py-1.5 text-sm text-aurelius-text placeholder:text-aurelius-text/30 w-32"
                        />
                        <button
                          disabled={busy || !(prices[o.id] ?? "").trim()}
                          onClick={() => post({ kind: "activate", offerId: o.id, price: Number(prices[o.id]) })}
                          className={btn}
                          title="Makes this the offer every draft, email and DM points at."
                        >
                          Make it live
                        </button>
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

  const btn = "px-3 py-1.5 rounded border border-aurelius-gold/50 text-aurelius-gold text-xs hover:bg-aurelius-gold/10 disabled:opacity-40";

  return (
    <section className="rounded border border-aurelius-gold/20 bg-black/30 p-4">
      <div className="flex justify-between items-baseline gap-4 mb-2">
        <h2 className="aurelius-heading text-sm uppercase tracking-[0.2em] text-aurelius-gold/80">What you say</h2>
        <button disabled={busy} onClick={async () => { if (await post({ kind: "propose", count: 3 })) onChange(); }} className={btn}>
          {busy ? "Researching…" : "Propose angles"}
        </button>
      </div>

      {/* The honest read on sample size comes FIRST — a 33% reply rate from
          three sends is noise, and printing it as a rate teaches him something
          false about his own market. */}
      <p className="text-xs text-aurelius-text/60 mb-3">
        {marketing?.headline ?? "No angles yet. An angle is a testable claim about what makes one specific person reply."}
      </p>
      {!hasOffer && angles.length > 0 && (
        <p className="text-[11px] text-amber-200/80 mb-3">
          No offer is live, so this copy can start a conversation but can&apos;t close one. Define an offer above first.
        </p>
      )}
      {err && <div className="rounded border border-red-500/40 bg-red-950/20 p-2 text-xs text-red-200 mb-3">{err}</div>}

      {angles.length > 0 && (
        <>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] uppercase tracking-[0.2em] text-aurelius-gold/50">write as</span>
            <select value={format} onChange={(e) => setFormat(e.target.value)}
              className="bg-black/50 border border-aurelius-gold/30 rounded px-2 py-1 text-xs text-aurelius-text">
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
                  <div className="text-[11px] text-aurelius-text/40">{a.audience}</div>
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
        <div className="mt-4 rounded border border-aurelius-gold/25 bg-black/50 p-3">
          <div className="flex justify-between items-baseline gap-4 mb-2">
            <div className="text-[10px] uppercase tracking-[0.2em] text-aurelius-gold/50">{draft.angle}</div>
            <button onClick={() => setDraft(null)} className="text-[11px] text-aurelius-text/40 hover:text-aurelius-text/70">close</button>
          </div>
          <pre className="whitespace-pre-wrap text-sm text-aurelius-text/85 font-sans leading-relaxed">{draft.body}</pre>
          <p className="text-[10px] text-amber-200/70 mt-3">{draft.trust}</p>
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
            <span className="text-[10px] text-aurelius-text/40">
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

  const btn = "px-3 py-1.5 rounded border border-aurelius-gold/50 text-aurelius-gold text-xs hover:bg-aurelius-gold/10 disabled:opacity-40";

  return (
    <section className="rounded border border-aurelius-gold/20 bg-black/30 p-4">
      <h2 className="aurelius-heading text-sm uppercase tracking-[0.2em] text-aurelius-gold/80 mb-2">
        What you&apos;ve written
      </h2>
      {/* A full queue is not output. The headline refuses to let a pile of
          unpublished drafts read as progress. */}
      <p className="text-xs text-aurelius-text/60 mb-3">{state?.headline ?? "Loading…"}</p>
      {err && <div className="rounded border border-red-500/40 bg-red-950/20 p-2 text-xs text-red-200 mb-3">{err}</div>}

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
                  <div className="text-[11px] text-aurelius-text/40">
                    {[d.channel, d.format?.replace(/_/g, " "), d.angle ? `from "${d.angle.title}"` : null].filter(Boolean).join(" · ")}
                  </div>
                </div>
                <div className="text-right text-[11px] shrink-0">
                  <div className={
                    d.status === "published" ? "text-emerald-400/80"
                    : d.status === "staged" ? "text-amber-300/80"
                    : d.status === "ready" ? "text-aurelius-gold/70"
                    : "text-aurelius-text/50"
                  }>
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
                        className="w-full bg-black/50 border border-aurelius-gold/30 rounded px-3 py-2 text-sm text-aurelius-text leading-relaxed"
                      />
                      <div className="flex flex-wrap gap-2 items-center">
                        <button
                          disabled={busy || (edits[d.id] ?? d.body) === d.body}
                          onClick={() => post({ kind: "edit", draftId: d.id, body: edits[d.id] })}
                          className={btn}
                        >
                          Save my version
                        </button>
                        {d.status === "draft" && (
                          <button disabled={busy} onClick={() => post({ kind: "edit", draftId: d.id, status: "ready" })} className={btn}>
                            Mark ready
                          </button>
                        )}
                        {d.channel === "instagram" && (
                          <input
                            value={images[d.id] ?? d.imageUrl ?? ""}
                            onChange={(e) => setImages({ ...images, [d.id]: e.target.value })}
                            onBlur={() => images[d.id] !== undefined && post({ kind: "edit", draftId: d.id, imageUrl: images[d.id] })}
                            placeholder="public image URL"
                            className="bg-black/50 border border-aurelius-gold/30 rounded px-2 py-1.5 text-xs text-aurelius-text placeholder:text-aurelius-text/30 flex-1 min-w-[12rem]"
                            title="Instagram fetches the image itself, so it has to be a public URL — an upload won't work."
                          />
                        )}
                        {d.status !== "staged" && (
                          <button
                            disabled={busy}
                            onClick={() => post({ kind: "publish", draftId: d.id })}
                            className={btn}
                            title="Stages it on the Bridge for your confirm. Nothing goes out until you tap."
                          >
                            Publish…
                          </button>
                        )}
                        <button
                          disabled={busy}
                          onClick={() => post({ kind: "discard", draftId: d.id })}
                          className="text-[11px] text-aurelius-text/40 hover:text-red-300 disabled:opacity-40"
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
                        <p className="text-[10px] text-amber-200/70">
                          Waiting on the Bridge for your confirm. Nothing has gone out.
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

function Stat({ label, value, hint, alert }: { label: string; value: string; hint?: string; alert?: boolean }) {
  return (
    <div className={`rounded border p-3 ${alert ? "border-red-500/40 bg-red-950/10" : "border-aurelius-gold/25 bg-black/40"}`}>
      <div className="text-[10px] uppercase tracking-[0.2em] text-aurelius-gold/50">{label}</div>
      <div className="text-xl text-aurelius-text/90 mt-1">{value}</div>
      {hint && <div className={`text-[11px] mt-0.5 ${alert ? "text-red-300/80" : "text-aurelius-text/40"}`}>{hint}</div>}
    </div>
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
    <section className="rounded border border-aurelius-gold/30 bg-black/40 p-4">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex justify-between items-center text-left"
      >
        <h2 className="aurelius-heading text-sm uppercase tracking-[0.2em] text-aurelius-gold/80">
          The warm list
        </h2>
        <span className="text-aurelius-gold/50 text-xs">{open ? "hide" : "open"}</span>
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          <p className="text-xs text-aurelius-text/60 leading-relaxed">
            The ten people you could message this week who might say yes — or who know someone who would.
            Old athletes, their parents, coaches you know. One per line. Add an email and how you know them
            if you have it: <span className="text-aurelius-text/40">Jake Miller, dana@example.com, trained him two years</span>
          </p>
          <textarea
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            rows={6}
            placeholder={"Jake Miller, dana@example.com, trained him two years\nSarah Chen, coached her sister\nCoach Davis, sends me athletes"}
            className="w-full bg-black/50 border border-aurelius-gold/30 rounded px-3 py-2 text-sm text-aurelius-text placeholder:text-aurelius-text/25 font-mono"
          />
          {err && <div className="rounded border border-red-500/40 bg-red-950/20 p-2 text-xs text-red-200">{err}</div>}
          {result && <div className="rounded border border-emerald-500/40 bg-emerald-950/20 p-2 text-xs text-emerald-200">{result}</div>}
          <div className="flex flex-wrap gap-2 items-center">
            <button
              disabled={busy || parsed.length === 0}
              onClick={async () => {
                const j = await post({ kind: "warm_list", entries: parsed });
                if (j) { setResult(`${j.created} added${j.skipped ? `, ${j.skipped} already known` : ""}. Each has a follow-up due today.`); setRaw(""); onChange(); }
              }}
              className="px-3 py-2 rounded border border-aurelius-gold/50 text-aurelius-gold text-sm hover:bg-aurelius-gold/10 disabled:opacity-40"
            >
              {busy ? "Adding…" : `Add ${parsed.length || ""} to the pipeline`}
            </button>
            <button
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
              className="px-3 py-2 rounded border border-aurelius-gold/30 text-aurelius-text/80 text-sm hover:text-aurelius-gold disabled:opacity-40"
              title="Drafts messages for every lead whose follow-up is due. Writes Gmail drafts only."
            >
              Draft what&apos;s due
            </button>
          </div>
          <p className="text-[10px] text-aurelius-text/40">
            Drafts land in your Gmail drafts for you to read and send. Aurelius never messages anyone on its own.
          </p>
        </div>
      )}
    </section>
  );
}
