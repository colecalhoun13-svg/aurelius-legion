"use client";

// THE BRIDGE — where Aurelius's background work meets Cole.
// Top: the review bench — knowledge proposals awaiting his ruling.
// Nothing enters Living Knowledge without passing this (or an explicit
// in-chat confirmation). Below: every signal, full body, inline actions.
//
// ELEVATED IMPERIAL re-dress (docs/REDESIGN_PLAN.md): the first pending
// card wears the inscription tablet (glass — rank, max ~2/page), the rest
// stand as stone slabs. A ruling slides the card off the bench (opacity +
// translateX + max-height collapse, template-faithful, inline transition)
// before the existing refetch removes it; the page hero's numeral ticks on
// the count we report up. Every handler, API call, and busy-guard from the
// working page survives unchanged.

import { useCallback, useEffect, useRef, useState } from "react";
import { Btn, LedgerRow, Panel, SectionLabel } from "../kit";

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

// Severity keeps its voice in the new dress: the kind-chip text color.
const SEV_TEXT: Record<string, string> = {
  critical: "var(--danger)",
  attention: "var(--attn)",
  notice: "var(--gold)",
  info: "var(--ink3)",
};

type RecentAction = { id: string; title: string; createdAt: string; actionClass: string | null };

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export default function BridgePage({ onPendingCount }: { onPendingCount?: (n: number) => void }) {
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

  const pendingCount = (signals?.length ?? 0) + (proposals?.length ?? 0);

  // The hero numeral upstairs is this same count — the badge endpoint splits
  // on the same predicate as the deck, so the two can never disagree.
  useEffect(() => {
    if (signals !== null || proposals !== null) onPendingCount?.(pendingCount);
  }, [signals, proposals, pendingCount, onPendingCount]);

  /* ── the ruling exit: card slides off the bench before the refetch drops it.
       Template-faithful (measure scrollHeight → double-rAF → collapse), all
       inline so no stylesheet is touched. Reduced-motion rules instantly. ── */
  const cardRefs = useRef(new Map<string, HTMLElement>());
  const setCardRef = (id: string) => (node: HTMLElement | null) => {
    if (node) cardRefs.current.set(id, node);
    else cardRefs.current.delete(id);
  };
  const animateAway = async (id: string) => {
    const el = cardRefs.current.get(id);
    if (!el) return;
    if (typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    el.style.overflow = "hidden";
    el.style.transition =
      "opacity .5s var(--au-ease), transform .5s var(--au-ease), max-height .55s var(--au-ease), margin .55s var(--au-ease)";
    el.style.maxHeight = el.scrollHeight + "px";
    await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
    el.style.opacity = "0";
    el.style.transform = "translateX(28px)";
    el.style.maxHeight = "0";
    el.style.marginTop = "0";
    el.style.marginBottom = "0";
    await sleep(560);
  };
  // If the refetch brings the card back (the ruling failed server-side), the
  // same DOM node survives keyed — clear the exit styles so it stands again.
  const resetCard = (id: string) => {
    const el = cardRefs.current.get(id);
    if (!el) return;
    for (const p of ["overflow", "transition", "opacity", "transform", "max-height", "margin-top", "margin-bottom"])
      el.style.removeProperty(p);
  };

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
      } else {
        await animateAway(id);
      }
      await load();
      resetCard(id);
    } finally {
      setBusy(null);
    }
  };

  const act = async (id: string, status: string) => {
    const res = await fetch("/api/today/actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "ackSignal", id, status, date: localDate() }),
    });
    if (res.ok) await animateAway(id);
    await load();
    resetCard(id);
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
      } else {
        await animateAway(id);
      }
      await load();
      resetCard(id);
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
      await animateAway(id);
      await load();
      resetCard(id);
    } finally {
      setBusy(null);
    }
  };

  // The FIRST pending card — proposal if any stand, else the first signal —
  // wears the inscription tablet; the rest are stone.
  const firstGlassProposal = (proposals?.length ?? 0) > 0;

  const kindChip = (text: string, color: string) => (
    <span
      style={{
        fontFamily: "var(--font-body),Georgia,serif",
        fontWeight: 600,
        fontSize: 12,
        letterSpacing: ".28em",
        textTransform: "uppercase",
        color,
      }}
      className="shrink-0"
    >
      {text}
    </span>
  );

  return (
    <main className="text-aurelius-text max-w-3xl mx-auto space-y-6">
      {/* One name per surface (alignment council): the nav chip calls this
          "From Aurelius" — the header must not answer to a different name.
          The big count lives in the page hero now; this row keeps the words. */}
      <header>
        <div className="flex items-baseline justify-between gap-4 flex-wrap">
          <SectionLabel row>From Aurelius</SectionLabel>
          <span className="au-kicker">
            {signals === null && proposals === null ? "…" : `${pendingCount} pending`}
          </span>
        </div>
        <div className="au-rule" />
      </header>

      {/* THE REVIEW BENCH — proposals await Cole's ruling */}
      {proposals && proposals.length > 0 && (
        <section className="space-y-4">
          <SectionLabel>Awaiting your ruling</SectionLabel>
          {proposals.map((p, i) => (
            <div key={p.id} ref={setCardRef(p.id)}>
              <Panel tier={firstGlassProposal && i === 0 ? "glass" : "card"}>
                {/* Plain English leads; machine identifiers demote to metadata —
                    Cole rules on a sentence, not on scope.key · intent_class_id. */}
                <div className="flex items-start justify-between gap-3">
                  <span className="text-sm" style={{ color: "var(--ink)" }}>
                    {p.rationale || p.coleNaturalLanguage || `${p.scope}.${p.key}`}
                  </span>
                  {kindChip("Proposal", "var(--gold)")}
                </div>

                <div className="mt-3 text-sm space-y-1.5">
                  {p.priorValue !== null && (
                    <p style={{ color: "var(--ink3)" }}>
                      <span className="text-[11px] uppercase tracking-wider mr-2">now</span>
                      <span className="line-through decoration-neutral-600">{showValue(p.priorValue)}</span>
                    </p>
                  )}
                  <p style={{ color: "var(--ink2)" }}>
                    <span className="text-[11px] uppercase tracking-wider mr-2" style={{ color: "var(--gold-dim)" }}>
                      proposed
                    </span>
                    {showValue(p.proposedValue)}
                  </p>
                  {p.rationale && p.coleNaturalLanguage && !p.coleNaturalLanguage.startsWith("(") && (
                    <p className="au-kicker" style={{ fontSize: 13 }}>from: “{p.coleNaturalLanguage}”</p>
                  )}
                  <p className="text-[11px] mt-2" style={{ color: "var(--ink3)" }}>
                    {p.scope}.{p.key} · {p.operatorName} · {p.intentClassId.replace(/_/g, " ")}
                  </p>
                </div>

                <div className="flex items-center gap-2 mt-4 flex-wrap">
                  <Btn onClick={() => rule(p.id, "confirmed")} disabled={busy === p.id}>
                    Confirm
                  </Btn>
                  <Btn ghost onClick={() => rule(p.id, "denied")} disabled={busy === p.id}>
                    Deny
                  </Btn>
                  <span className="au-kicker" style={{ fontSize: 12.5, marginLeft: ".5rem" }}>
                    applies to Living Knowledge only on confirm
                  </span>
                </div>
              </Panel>
            </div>
          ))}
        </section>
      )}

      {err && <p className="text-sm text-amber-300/90">{err}</p>}

      {signals && signals.length === 0 && (proposals?.length ?? 0) === 0 && (
        <p className="au-kicker text-center py-16" style={{ display: "block", fontSize: "1.05rem" }}>
          Quiet. When Aurelius finishes something in the background — a research pass,
          a closed-out day, a pattern worth confirming — it lands here.
        </p>
      )}

      {/* DONE ON ITS OWN — executed under a granted keyhole, still reversible.
          The receipts reach the ruling surface, not just the Autonomy tab. */}
      {recentActions.length > 0 && (
        <section>
          <SectionLabel gold>Done on its own — reversible</SectionLabel>
          <div style={{ height: ".4rem" }} />
          {recentActions.map((a) => (
            <div key={a.id} ref={setCardRef(a.id)}>
              <LedgerRow
                tick="em"
                verb={a.title}
                obj={`${a.actionClass ?? "autonomous"} · ${new Date(a.createdAt).toLocaleString([], {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}`}
                right={
                  <button className="au-undo" onClick={() => undo(a.id)} disabled={busy === a.id}>
                    {busy === a.id ? "undoing…" : "undo"}
                  </button>
                }
              />
            </div>
          ))}
        </section>
      )}

      <ul className="space-y-4">
        {(signals ?? []).map((s, i) => (
          <li key={s.id} ref={setCardRef(s.id)}>
            <Panel tier={!firstGlassProposal && i === 0 ? "glass" : "card"}>
              <div className="flex items-start justify-between gap-3">
                <span className="font-medium" style={{ color: "var(--ink)" }}>{s.title}</span>
                {kindChip(s.kind.replace(/_/g, " "), SEV_TEXT[s.severity] ?? SEV_TEXT.info)}
              </div>
              {s.body && (
                <p className="text-sm mt-2 whitespace-pre-line" style={{ color: "var(--ink2)" }}>
                  {s.body}
                </p>
              )}
              <div className="flex gap-2 mt-4 flex-wrap">
                {confirmableAction(s) && s.status !== "acted" && (
                  <Btn onClick={() => confirmAndDo(s.id)} disabled={busy === s.id}>
                    {busy === s.id ? "Doing it…" : "Confirm & do it"}
                  </Btn>
                )}
                <Btn ghost onClick={() => act(s.id, "acknowledged")}>Got it</Btn>
                <Btn ghost onClick={() => act(s.id, "acted")}>Acted on it</Btn>
                <Btn ghost onClick={() => act(s.id, "dismissed")}>Dismiss</Btn>
                <Btn
                  ghost
                  onClick={() => correct(s.id)}
                  className="ml-auto"
                  style={{ color: "var(--danger)", borderColor: "rgba(201,107,90,.4)" }}
                  title="Record a correction — Aurelius learns from what it gets wrong"
                >
                  That’s wrong
                </Btn>
              </div>
            </Panel>
          </li>
        ))}
      </ul>

      {/* Receipts — landed "pending" but carry no ruling. Kept out of the queue
          above and off the bell; visible here, collapsed, dismissable. */}
      {receipts.length > 0 && (
        <section className="space-y-2">
          <button
            onClick={() => setReceiptsOpen((o) => !o)}
            className="au-kicker hover:text-aurelius-gold"
            style={{ background: "none", border: 0, cursor: "pointer", padding: 0 }}
          >
            {receipts.length} update{receipts.length === 1 ? "" : "s"}, nothing to decide {receiptsOpen ? "· hide" : "· see"}
          </button>
          {receiptsOpen && (
            <ul>
              {receipts.map((s) => (
                <li key={s.id} ref={setCardRef(s.id)} className="au-lrow" style={{ alignItems: "flex-start" }}>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm au-verb">{s.title}</span>
                    {s.body && (
                      <span
                        className="block text-xs mt-1 whitespace-pre-line line-clamp-2"
                        style={{ color: "var(--ink3)" }}
                      >
                        {s.body}
                      </span>
                    )}
                  </span>
                  <button className="au-undo" onClick={() => act(s.id, "acknowledged")}>
                    got it
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
