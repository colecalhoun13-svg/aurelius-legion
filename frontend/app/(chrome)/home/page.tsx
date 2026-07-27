"use client";

// THE ONE HOME — every daily verb on one screen, under a strict attention
// budget (the council's guardrail against the airline-app homepage):
// above the fold: greeting, ONE confrontation line, the needs-you strip
// (only if nonempty), and the chat. Briefing collapses to a line once
// read; overnight receipts collapse to a count; tasks/habits live one
// scroll down. When nothing needs Cole, this screen is nearly empty —
// that calm IS the product.

import { useCallback, useEffect, useState } from "react";
import { AureliusChat } from "../../../components/AureliusChat";

type SignalAction = { label: string; action: string; payload?: any };
type Signal = {
  id: string; kind: string; severity: string; title: string; body: string;
  createdAt: string; status?: string; actions?: SignalAction[] | null;
};
type Deck = {
  date: string;
  hero: { overdue: number; doneToday: number; openToday: number; followThrough: number | null; attentionSignals: number };
  biggestRisk: string;
  plan: { focus: string | null } | null;
  bridge: Signal[];
  overnight: Signal[];
};
type Task = { id: string; title: string; status: string; priority: string; domain: string };
type Habit = { id: string; name: string; streak: number; doneToday: boolean };
type TodayData = { tasks: Task[]; overdue: Task[]; habits: Habit[]; doneToday: number };

const confirmable = (s: Signal) => (s.actions ?? []).find((a) => a?.action === "confirm_action");
const undoable = (s: Signal) => (s.actions ?? []).find((a) => a?.action === "undo_action");

function localDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return "Late night";
  if (h < 12) return "Morning";
  if (h < 18) return "Afternoon";
  return "Evening";
}

const SEV: Record<string, string> = {
  critical: "border-red-400/50",
  attention: "border-amber-400/50",
  notice: "border-aurelius-gold/50",
  info: "border-aurelius-gold/25",
};

export default function HomePage() {
  const [deck, setDeck] = useState<Deck | null>(null);
  const [today, setToday] = useState<TodayData | null>(null);
  const [briefing, setBriefing] = useState<{ text: string; at: string } | null>(null);
  const [briefingOpen, setBriefingOpen] = useState(false);
  const [debrief, setDebrief] = useState<string | null>(null);
  const [debriefOpen, setDebriefOpen] = useState(false);
  const [overnightOpen, setOvernightOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [newTask, setNewTask] = useState("");

  const load = useCallback(async () => {
    try {
      const [d, t] = await Promise.all([
        fetch(`/api/deck?date=${localDate()}`),
        fetch(`/api/today?date=${localDate()}`),
      ]);
      if (d.ok) setDeck(await d.json());
      if (t.ok) setToday(await t.json());
    } catch { /* home stays calm even when the backend naps */ }
  }, []);

  useEffect(() => {
    load();
    fetch("/api/rituals")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        // Evenings get the debrief instead of a morning museum piece.
        if (j?.nightly_debrief?.outputText && new Date().getHours() >= 20) {
          setDebrief(j.nightly_debrief.outputText);
        }
        if (j?.morning_briefing?.outputText) {
          setBriefing({ text: j.morning_briefing.outputText, at: j.morning_briefing.firedAt });
          // Unread today → open; already seen this session → a quiet line.
          try {
            const seen = sessionStorage.getItem("aurelius_briefing_seen");
            if (seen !== j.morning_briefing.firedAt) {
              setBriefingOpen(true);
              sessionStorage.setItem("aurelius_briefing_seen", j.morning_briefing.firedAt);
            }
          } catch { setBriefingOpen(true); }
        }
      })
      .catch(() => {});
  }, [load]);

  const act = useCallback(async (payload: Record<string, any>) => {
    await fetch("/api/today/actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: localDate(), ...payload }),
    });
    await load();
  }, [load]);

  const rule = useCallback(async (endpoint: string, id: string) => {
    if (busy) return;
    setBusy(id);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signalId: id }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        window.alert(`Couldn't do that: ${j.error ?? "try again in a moment"}`);
      }
      await load();
    } finally {
      setBusy(null);
    }
  }, [busy, load]);

  const bridge = deck?.bridge ?? [];
  const overnight = deck?.overnight ?? [];
  const tasks = [...(today?.overdue ?? []), ...(today?.tasks ?? [])];

  return (
    <div className="max-w-2xl mx-auto text-aurelius-text aurelius-stagger flex flex-col min-h-full">
      {/* ── Above the fold: the day, in one breath ── */}
      <header className="text-center pt-2">
        <h1 className="aurelius-heading text-4xl md:text-5xl">{greeting()}, Operator</h1>
        {deck?.biggestRisk && (
          <p
            className={`mt-3 text-base leading-snug ${
              deck.biggestRisk.startsWith("Nothing's on fire") ? "text-neutral-400" : "text-amber-300"
            }`}
          >
            {deck.biggestRisk}
          </p>
        )}
        {deck?.plan?.focus && (
          <p className="mt-2 text-sm text-neutral-300">
            <span className="text-aurelius-gold/70 aurelius-heading text-xs mr-2">Focus</span>
            {deck.plan.focus}
          </p>
        )}
      </header>

      {/* Briefing — open when fresh, one quiet line once read */}
      {briefing && (
        <section className="mt-5">
          {briefingOpen ? (
            <div className="aurelius-panel-frame border border-aurelius-gold/25 p-4">
              <div className="flex items-baseline justify-between">
                <span className="aurelius-heading text-sm text-aurelius-gold/80">Morning briefing</span>
                <button onClick={() => setBriefingOpen(false)} className="text-xs text-neutral-500 hover:text-aurelius-gold">
                  collapse
                </button>
              </div>
              <p className="mt-2 text-sm text-neutral-300 whitespace-pre-wrap leading-relaxed">{briefing.text}</p>
            </div>
          ) : (
            <button
              onClick={() => setBriefingOpen(true)}
              className="w-full text-left text-xs text-neutral-500 hover:text-aurelius-gold px-1"
            >
              ✦ Briefing read — tap to reopen
            </button>
          )}
        </section>
      )}

      {/* Evening debrief — a quiet line after 20:00, opens on tap */}
      {debrief && (
        <section className="mt-3">
          {debriefOpen ? (
            <div className="aurelius-panel-frame border border-aurelius-gold/25 p-4">
              <div className="flex items-baseline justify-between">
                <span className="aurelius-heading text-sm text-aurelius-gold/80">Evening debrief</span>
                <button onClick={() => setDebriefOpen(false)} className="text-xs text-neutral-500 hover:text-aurelius-gold">
                  collapse
                </button>
              </div>
              <p className="mt-2 text-sm text-neutral-300 whitespace-pre-wrap leading-relaxed">{debrief}</p>
            </div>
          ) : (
            <button
              onClick={() => setDebriefOpen(true)}
              className="w-full text-left text-xs text-neutral-500 hover:text-aurelius-gold px-1"
            >
              ☾ The day's debrief is in — tap to read
            </button>
          )}
        </section>
      )}

      {/* Needs-you strip — renders NOTHING when nothing needs him */}
      {bridge.length > 0 && (
        <section className="mt-5 space-y-2">
          <span className="aurelius-heading text-sm text-aurelius-gold/70 px-1">Needs you</span>
          {bridge.slice(0, 3).map((s) => (
            <div key={s.id} className={`aurelius-panel-frame border p-3.5 ${SEV[s.severity] ?? SEV.info}`}>
              <p className="text-sm font-medium">{s.title}</p>
              {s.body && <p className="text-xs text-neutral-400 mt-1 line-clamp-3 whitespace-pre-wrap">{s.body}</p>}
              <div className="flex gap-2 mt-2.5">
                {confirmable(s) && (
                  <button
                    onClick={() => rule("/api/autonomy/confirm", s.id)}
                    disabled={busy === s.id}
                    className="text-xs bg-aurelius-gold text-black font-semibold rounded-lg px-3 py-1.5 disabled:opacity-50"
                  >
                    {busy === s.id ? "…" : "Confirm & do it"}
                  </button>
                )}
                {undoable(s) && (
                  <button
                    onClick={() => rule("/api/autonomy/undo", s.id)}
                    disabled={busy === s.id}
                    className="text-xs border border-amber-400/60 text-amber-300 rounded-lg px-3 py-1.5 disabled:opacity-50"
                  >
                    Undo
                  </button>
                )}
                <button
                  onClick={() => act({ action: "ackSignal", id: s.id, status: "acknowledged" })}
                  className="text-xs border border-aurelius-gold/40 text-aurelius-gold rounded-lg px-3 py-1.5"
                >
                  Got it
                </button>
                <button
                  onClick={() => act({ action: "ackSignal", id: s.id, status: "dismissed" })}
                  className="text-xs text-neutral-500 hover:text-neutral-300 px-2"
                >
                  Dismiss
                </button>
              </div>
            </div>
          ))}
          {bridge.length > 3 && (
            <a href="/decisions" className="block text-xs text-neutral-500 hover:text-aurelius-gold px-1">
              +{bridge.length - 3} more on Decisions →
            </a>
          )}
        </section>
      )}

      {/* Overnight receipts — proof of the night shift, collapsed to a count */}
      {overnight.length > 0 && (
        <section className="mt-5">
          <button
            onClick={() => setOvernightOpen((o) => !o)}
            className="text-xs text-neutral-500 hover:text-aurelius-gold px-1"
          >
            ✓ {overnight.length} thing{overnight.length === 1 ? "" : "s"} handled while you were away{" "}
            {overnightOpen ? "· hide" : "· see"}
          </button>
          {overnightOpen && (
            <div className="mt-2 space-y-1.5">
              {overnight.map((s) => (
                <div key={s.id} className="flex items-start gap-2 text-xs px-1">
                  <span className="text-aurelius-gold/60 mt-px">✦</span>
                  <span className="text-neutral-400 flex-1">
                    {s.title}
                    <span className="text-neutral-600"> · {s.kind.replace(/_/g, " ")}</span>
                  </span>
                  {undoable(s) && (
                    <button
                      onClick={() => rule("/api/autonomy/undo", s.id)}
                      className="text-amber-300/80 hover:text-amber-300 shrink-0"
                    >
                      undo
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ── One scroll down: the day's work ── */}
      <section className="mt-6">
        <div className="flex items-baseline justify-between px-1 mb-2">
          <span className="aurelius-heading text-sm text-aurelius-gold/70">Today</span>
          <span className="text-[11px] text-neutral-500">
            {today ? `${today.doneToday} done · ${tasks.length} open` : ""}
          </span>
        </div>
        <ul className="space-y-1.5">
          {tasks.slice(0, 8).map((t) => (
            <li key={t.id} className="flex items-center gap-3 px-1">
              <button
                onClick={() => act({ action: "completeTask", id: t.id })}
                className={`relative after:absolute after:-inset-3 after:content-[''] w-4 h-4 border rounded-sm shrink-0 ${
                  t.status === "overdue" || (today?.overdue ?? []).some((o) => o.id === t.id)
                    ? "border-red-400 hover:bg-red-400/30"
                    : "border-aurelius-gold hover:bg-aurelius-gold/40"
                }`}
                title="Done"
              />
              <span className="text-sm text-neutral-200 flex-1 truncate">{t.title}</span>
            </li>
          ))}
          {tasks.length === 0 && <li className="text-neutral-500 italic text-sm px-1">Nothing on deck.</li>}
        </ul>
        <div className="flex gap-2 mt-3">
          <input
            value={newTask}
            onChange={(e) => setNewTask(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && newTask.trim()) {
                act({ action: "createTask", title: newTask.trim(), status: "today" });
                setNewTask("");
              }
            }}
            placeholder="Add a task for today…"
            className="flex-1 bg-black/40 border border-aurelius-gold/25 rounded-lg px-3 py-2 text-sm outline-none focus:border-aurelius-gold/60"
          />
        </div>
        {(today?.habits ?? []).length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {(today?.habits ?? []).map((h) => (
              <button
                key={h.id}
                onClick={() => !h.doneToday && act({ action: "completeHabit", id: h.id })}
                className={`text-xs rounded-full px-3 py-1.5 border min-h-[32px] ${
                  h.doneToday
                    ? "border-aurelius-gold bg-aurelius-gold/20 text-aurelius-gold"
                    : "border-aurelius-gold/30 text-neutral-400 hover:border-aurelius-gold/60"
                }`}
              >
                {h.doneToday ? "✓ " : ""}
                {h.name}
                {h.streak > 1 && <span className="opacity-70"> · {h.streak}</span>}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* ── The spine: talk to Aurelius (One Box lands fully in UX-PR6) ── */}
      <section className="mt-8 flex-1 flex flex-col">
        <AureliusChat />
      </section>
    </div>
  );
}
