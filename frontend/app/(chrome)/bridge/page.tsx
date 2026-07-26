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

export default function BridgePage() {
  const [signals, setSignals] = useState<Signal[] | null>(null);
  const [proposals, setProposals] = useState<Proposal[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [deckRes, propRes] = await Promise.all([fetch("/api/deck"), fetch("/api/proposals")]);
    if (deckRes.ok) setSignals((await deckRes.json()).bridge);
    if (propRes.ok) setProposals((await propRes.json()).proposals);
  }, []);

  useEffect(() => { load(); }, [load]);

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
        <h1 className="aurelius-heading text-4xl">The Bridge</h1>
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
              <div className="flex items-start justify-between gap-3">
                <span className="font-medium text-sm">
                  <span className="text-aurelius-gold">{p.scope}.{p.key}</span>
                  <span className="text-neutral-500"> · {p.operatorName} · {p.intentClassId.replace(/_/g, " ")}</span>
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
                {p.rationale && <p className="text-xs text-neutral-500 mt-2">{p.rationale}</p>}
                {p.coleNaturalLanguage && (
                  <p className="text-xs text-neutral-600 italic">from: “{p.coleNaturalLanguage}”</p>
                )}
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

      {signals && signals.length === 0 && (proposals?.length ?? 0) === 0 && (
        <p className="text-neutral-600 italic text-center py-16">
          Quiet. When Aurelius finishes something in the background — a research pass,
          a closed-out day, a pattern worth confirming — it lands here.
        </p>
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
    </main>
  );
}
