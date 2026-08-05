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

const STAGES = ["new", "contacted", "conversing", "proposed"] as const;
const SOURCES = ["manual", "referral", "instagram", "email", "word_of_mouth", "website", "other"] as const;

const money = (cents: number) => `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—");

export default function BusinessPage() {
  const [data, setData] = useState<{ pipeline: Snapshot; attention: Attention; clients: Client[]; leads: Lead[] } | null>(null);
  // A failed load must never render as "you have no business" — that reads
  // identically to the real empty state and would be a lie about his data.
  const [loadFailed, setLoadFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const { pipeline: snap, attention, clients, leads } = data;
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
      </header>

      {error && (
        <div className="rounded border border-red-500/40 bg-red-950/20 p-3 text-sm text-red-200">{error}</div>
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
              <li key={c.id} className="py-2 flex justify-between items-center gap-4">
                <div>
                  <div className="text-aurelius-text/90 text-sm">{c.name}</div>
                  <div className="text-[11px] text-aurelius-text/40">
                    {[c.sport, c.status !== "active" ? c.status : null].filter(Boolean).join(" · ") || "—"}
                  </div>
                </div>
                <div className="text-right text-[11px] text-aurelius-text/60">
                  {c.engagements.length === 0
                    ? <span className="text-amber-300/70">no engagement recorded</span>
                    : c.engagements.map((e) => (
                        <div key={e.id}>{e.title} · {money(e.priceCents)}{e.shape === "monthly" ? "/mo" : ""}</div>
                      ))}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
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
