"use client";

// THE BRIDGE — where Aurelius's background work meets Cole.
// Top: the review bench — knowledge proposals awaiting his ruling.
// Nothing enters Living Knowledge without passing this (or an explicit
// in-chat confirmation). Below: every signal, full body, inline actions.

import { useCallback, useEffect, useState } from "react";

type SignalAction = { label: string; action: string; payload?: any };
type Signal = {
  id: string;
  kind: string;
  severity: string;
  title: string;
  body: string;
  createdAt: string;
  status?: string;
  actions?: SignalAction[] | null;
};

function confirmableAction(s: Signal): SignalAction | undefined {
  return (s.actions ?? undefined)?.find?.((a) => a?.action === "confirm_action");
}
type Proposal = {
  id: string;
  operatorName: string;
  intentClassId: string;
  scope: string;
  key: string;
  proposedValue: any;
  priorValue: any | null;
  rationale: string;
  coleNaturalLanguage: string;
  createdAt: string;
};

function localDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function showValue(v: any): string {
  const s = typeof v === "string" ? v : JSON.stringify(v);
  return s.length > 160 ? s.slice(0, 160) + "…" : s;
}

const SEV: Record<string, string> = {
  critical: "text-red-400 border-red-400/50",
  attention: "text-amber-400 border-amber-400/50",
  notice: "text-aurelius-gold border-aurelius-gold/50",
  info: "text-neutral-400 border-aurelius-gold/25",
};

type RecentAction = { id: string; title: string; createdAt: string; actionClass: string | null };

export default function BridgePage() {
  const [signals, setSignals] = useState<Signal[] | null>(null);
  const [receipts, setReceipts] = useState<Signal[]>([]);
  const [receiptsOpen, setReceiptsOpen] = useState(false);
  const [proposals, setProposals] = useState<Proposal[] | null>(null);
  const [recentActions, setRecentActions] = useState<RecentAction[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [deckRes, propRes, dialRes] = await Promise.all([
        fetch("/api/deck"),
        fetch("/api/proposals"),
        fetch("/api/autonomy/dial"),
      ]);
      if (!deckRes.ok) throw new Error("Aurelius couldn't load the bench right now — try again in a moment.");
      const deck = await deckRes.json();
      setSignals(deck.bridge);
      // Receipts that leaked into "pending" but need no ruling — shown below,
      // collapsed, so the ruling queue above is only genuine decisions.
      setReceipts(deck.bridgeReceipts ?? []);
      if (propRes.ok) setProposals((await propRes.json()).proposals);
      // The other half of the trust loop: what it already did on its own,
      // still reversible — visible on the ruling surface, not just Autonomy.
      if (dialRes.ok) setRecentActions((await dialRes.json()).recentActions ?? []);
      setErr(null);
    } catch (e: any) {
      setErr(e?.message ?? "failed to load");
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const undo = async (id: string) => {
    if (busy) return;
    setBusy(id);
    try {
      const res = await fetch("/api/autonomy/undo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signalId: id }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        window.alert(`Couldn't undo: ${j.error ?? res.status}`);
      }
      await load();
    } finally {
      setBusy(null);
    }
  };

  const act = async (id: string, status: string) => {
    await fetch("/api/today/actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "ackSignal", id, status, date: localDate() }),
    });
    await load();
  };

  // The trust loop: "that's wrong" + why → Correction row, memory,
  // scoreboard signal. The signal dismisses once the correction lands.
  const correct = async (id: string) => {
    const reason = window.prompt("What's wrong here? (one line — this teaches Aurelius)");
    if (!reason?.trim()) return;
    await fetch("/api/corrections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetType: "bridge_signal", targetId: id, reason: reason.trim() }),
    });
    await act(id, "dismissed");
  };

  // Cole confirms a gated action proposal → the backend runs its finalizer
  // (places the calendar hold, creates the draft, …). This is what closes the
  // "propose → confirm → execute" loop; "Acted on it" only marks status.
  const confirmAndDo = async (id: string) => {
    if (busy) return;
    setBusy(id);
    try {
      const res = await fetch("/api/autonomy/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signalId: id }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        window.alert(`Couldn't do that: ${j.error ?? res.status}`);
      }
      await load();
    } finally {
      setBusy(null);
    }
  };

  const rule = async (id: string, decision: "confirmed" | "denied") => {
    if (busy) return;
    setBusy(id);
    try {
      await fetch("/api/proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, decision }),
      });
      await load();
    } finally {
      setBusy(null);
    }
  };

  const pendingCount = (signals?.length ?? 0) + (proposals?.length ?? 0);

  return (
    <main className="text-aurelius-text max-w-3xl mx-auto space-y-6 aurelius-stagger">
      <header className="flex items-baseline justify-between aurelius-rule">
        {/* One name per surface (alignment council): the nav calls this
            "From Aurelius" — the h1 must not answer to a different name. */}
        <h1 className="aurelius-heading text-4xl">From Aurelius</h1>
        <span className="text-sm text-neutral-500">
          {signals === null && proposals === null ? "…" : `${pendingCount} pending`}
        </span>
      </header>

      {/* THE REVIEW BENCH — proposals await Cole's ruling */}
      {proposals && proposals.length > 0 && (
        <section className="space-y-3">
          <h2 className="aurelius-heading text-lg">Awaiting your ruling</h2>
          {proposals.map((p) => (
            <div key={p.id} className="aurelius-panel-frame p-5 border border-sky-400/40">
              {/* Plain English leads; machine identifiers demote to metadata —
                  Cole rules on a sentence, not on scope.key · intent_class_id. */}
              <div className="flex items-start justify-between gap-3">
                <span className="font-medium text-sm text-neutral-100">
                  {p.rationale || p.coleNaturalLanguage || `${p.scope}.${p.key}`}
                </span>
                <span className="text-[10px] uppercase tracking-wider text-sky-300 border border-sky-400/40 rounded px-1.5 py-0.5 shrink-0">
                  proposal
                </span>
              </div>

              <div className="mt-3 text-sm space-y-1.5">
                {p.priorValue !== null && (
                  <p className="text-neutral-500">
                    <span className="text-[11px] uppercase tracking-wider mr-2">now</span>
                    <span className="line-through decoration-neutral-600">{showValue(p.priorValue)}</span>
                  </p>
                )}
                <p className="text-neutral-200">
                  <span className="text-[11px] uppercase tracking-wider text-aurelius-gold/70 mr-2">proposed</span>
                  {showValue(p.proposedValue)}
                </p>
                {p.rationale && p.coleNaturalLanguage && !p.coleNaturalLanguage.startsWith("(") && (
                  <p className="text-xs text-neutral-600 italic">from: “{p.coleNaturalLanguage}”</p>
                )}
                <p className="text-[11px] text-neutral-600 mt-2">
                  {p.scope}.{p.key} · {p.operatorName} · {p.intentClassId.replace(/_/g, " ")}
                </p>
              </div>

              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => rule(p.id, "confirmed")}
                  disabled={busy === p.id}
                  className="text-sm border border-emerald-500/40 rounded-lg px-4 py-1 hover:bg-emerald-500/15 text-emerald-400 disabled:opacity-40"
                >
                  Confirm
                </button>
                <button
                  onClick={() => rule(p.id, "denied")}
                  disabled={busy === p.id}
                  className="text-sm border border-red-500/40 rounded-lg px-4 py-1 hover:bg-red-500/15 text-red-400 disabled:opacity-40"
                >
                  Deny
                </button>
                <span className="text-[11px] text-neutral-600 self-center ml-2">
                  applies to Living Knowledge only on confirm
                </span>
              </div>
            </div>
          ))}
        </section>
      )}

      {err && <p className="text-sm text-amber-300/90">{err}</p>}

      {signals && signals.length === 0 && (proposals?.length ?? 0) === 0 && (
        <p className="text-neutral-600 italic text-center py-16">
          Quiet. When Aurelius finishes something in the background — a research pass,
          a closed-out day, a pattern worth confirming — it lands here.
        </p>
      )}

      {/* DONE ON ITS OWN — executed under a granted keyhole, still reversible.
          The receipts reach the ruling surface, not just the Autonomy tab. */}
      {recentActions.length > 0 && (
        <section className="space-y-2">
          <h2 className="aurelius-heading text-sm text-aurelius-gold/70 tracking-widest">Done on its own — reversible</h2>
          {recentActions.map((a) => (
            <div key={a.id} className="flex items-start gap-3 aurelius-panel-frame border border-aurelius-gold/15 px-4 py-2.5">
              <span className="text-aurelius-gold/60 mt-px">✦</span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm text-neutral-300 truncate">{a.title}</span>
                <span className="block text-[11px] text-neutral-600 mt-0.5">
                  {a.actionClass ?? "autonomous"} ·{" "}
                  {new Date(a.createdAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </span>
              </span>
              <button
                onClick={() => undo(a.id)}
                disabled={busy === a.id}
                className="text-xs border border-amber-500/50 rounded-lg px-3 py-1 hover:bg-amber-500/15 text-amber-300 disabled:opacity-50 shrink-0"
              >
                {busy === a.id ? "Undoing…" : "Undo"}
              </button>
            </div>
          ))}
        </section>
      )}

      <ul className="space-y-4">
        {(signals ?? []).map((s) => (
          <li key={s.id} className={`aurelius-panel-frame p-5 border ${SEV[s.severity] ?? SEV.info}`}>
            <div className="flex items-start justify-between gap-3">
              <span className="font-medium">{s.title}</span>
              <span className="text-[10px] uppercase tracking-wider opacity-70 shrink-0 border border-current rounded px-1.5 py-0.5">
                {s.kind.replace(/_/g, " ")}
              </span>
            </div>
            {s.body && <p className="text-sm text-neutral-400 mt-2 whitespace-pre-line">{s.body}</p>}
            <div className="flex gap-2 mt-4 flex-wrap">
              {confirmableAction(s) && s.status !== "acted" && (
                <button onClick={() => confirmAndDo(s.id)} disabled={busy === s.id}
                  className="text-sm border border-emerald-500/60 rounded-lg px-3 py-1 hover:bg-emerald-500/25 text-emerald-300 font-medium disabled:opacity-50">
                  {busy === s.id ? "Doing it…" : `Confirm & do it`}
                </button>
              )}
              <button onClick={() => act(s.id, "acknowledged")}
                className="text-sm border border-aurelius-gold/40 rounded-lg px-3 py-1 hover:bg-aurelius-gold/20 text-aurelius-gold">Got it</button>
              <button onClick={() => act(s.id, "acted")}
                className="text-sm border border-emerald-500/40 rounded-lg px-3 py-1 hover:bg-emerald-500/15 text-emerald-400">Acted on it</button>
              <button onClick={() => act(s.id, "dismissed")}
                className="text-sm border border-neutral-600 rounded-lg px-3 py-1 hover:bg-neutral-800 text-neutral-400">Dismiss</button>
              <button onClick={() => correct(s.id)}
                className="text-sm border border-red-500/30 rounded-lg px-3 py-1 hover:bg-red-500/10 text-red-400/80 ml-auto"
                title="Record a correction — Aurelius learns from what it gets wrong">That’s wrong</button>
            </div>
          </li>
        ))}
      </ul>

      {/* Receipts — landed "pending" but carry no ruling. Kept out of the queue
          above and off the bell; visible here, collapsed, dismissable. */}
      {receipts.length > 0 && (
        <section className="space-y-2">
          <button
            onClick={() => setReceiptsOpen((o) => !o)}
            className="aurelius-heading text-sm text-neutral-500 hover:text-aurelius-gold tracking-widest"
          >
            {receipts.length} update{receipts.length === 1 ? "" : "s"}, nothing to decide {receiptsOpen ? "· hide" : "· see"}
          </button>
          {receiptsOpen && (
            <ul className="space-y-2">
              {receipts.map((s) => (
                <li key={s.id} className="flex items-start gap-3 aurelius-panel-frame border border-aurelius-gold/15 px-4 py-2.5">
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm text-neutral-300">{s.title}</span>
                    {s.body && <span className="block text-xs text-neutral-500 mt-1 whitespace-pre-line line-clamp-2">{s.body}</span>}
                  </span>
                  <button
                    onClick={() => act(s.id, "acknowledged")}
                    className="text-xs border border-aurelius-gold/40 rounded-lg px-3 py-1 hover:bg-aurelius-gold/20 text-aurelius-gold shrink-0"
                  >
                    Got it
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </main>
  );
}
