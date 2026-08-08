"use client";

// THE ONE HOME — every daily verb on one screen, under a strict attention
// budget (the council's guardrail against the airline-app homepage):
// above the fold: greeting, ONE confrontation line, the needs-you strip
// (only if nonempty), and the chat. Briefing collapses to a line once
// read; overnight receipts collapse to a count; tasks/habits live one
// scroll down. When nothing needs Cole, this screen is nearly empty —
// that calm IS the product.
//
// ELEVATED IMPERIAL re-dress (docs/REDESIGN_PLAN.md): same verbs, same
// fetches, same handlers — re-skinned in the engraving grammar, plus one
// new instrument: the Day Dial (components/kit/DayDial), fed from the
// calendar mirror, /api/upnext, and /api/spine. Re-dress, never delete.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AureliusChat } from "../../../components/AureliusChat";
import { QUOTES } from "../../../lib/quotes";
import { Panel, SectionLabel, Divider, Tick, LedgerRow, Btn, useCountUp } from "../../../components/kit";
import { DayDial, type DialEvent, type SpineTick } from "../../../components/kit/DayDial";

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
  bridgeReceipts?: Signal[];
  overnight: Signal[];
};
type Task = { id: string; title: string; status: string; priority: string; domain: string };
type Habit = { id: string; name: string; streak: number; doneToday: boolean };
type TodayData = { tasks: Task[]; overdue: Task[]; habits: Habit[]; doneToday: number };
type UpNext = {
  nextEvent: { title: string; startAt: string; allDay: boolean } | null;
  freeHours: number;
  nextMove: { time: string; label: string; tomorrow: boolean };
};
type PromiseRow = {
  id: string;
  direction: "owed_by_cole" | "waiting_on";
  counterpart: string;
  text: string;
  dueAt: string | null;
  status: string; // "open" | "lapsed"
};

// "due today" / "lapsed" / "due 08-14" — the ledger speaks in states, not timestamps.
function promiseDueLabel(p: PromiseRow): string | null {
  if (p.status === "lapsed") return "lapsed";
  if (!p.dueAt) return null;
  const due = new Date(p.dueAt);
  const today = localDate();
  const dueDay = `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, "0")}-${String(due.getDate()).padStart(2, "0")}`;
  if (dueDay === today) return "due today";
  return `due ${dueDay.slice(5)}`;
}

// "in 40 min" / "in 3 h" — trajectory, not timestamps.
function untilLabel(iso: string): string {
  const min = Math.round((new Date(iso).getTime() - Date.now()) / 60_000);
  if (min <= 0) return "now";
  if (min < 60) return `in ${min} min`;
  const h = Math.floor(min / 60);
  return min % 60 >= 30 ? `in ${h}½ h` : `in ${h} h`;
}

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

// Severity → ink for the needs-you tablet (the tablet itself is THE surface;
// severity lives in the title's color, not a border zoo).
const SEV_INK: Record<string, string> = {
  critical: "var(--danger)",
  attention: "var(--attn)",
  notice: "var(--ink)",
  info: "var(--ink)",
};

// Roman count for the tablet label — "Needs you · Ⅱ".
const ROMAN = ["", "Ⅰ", "Ⅱ", "Ⅲ", "Ⅳ", "Ⅴ", "Ⅵ", "Ⅶ", "Ⅷ", "Ⅸ", "Ⅹ", "Ⅺ", "Ⅻ"];
const roman = (n: number) => ROMAN[n] ?? String(n);

// The scheduled spine mapped onto the dial face (jobName → local hour).
// Mirrors the cron roster in aurelius/index.ts; unknown names simply skip.
const JOB_HOURS: Record<string, number> = {
  db_backup: 2,
  inbox_triage: 5.5,
  rss_ingest: 6,
  market_pulse: 6.5,
  schedule_protection: 6.75,
  morning_briefing: 7,
  outreach_sweep: 7.5,
  initiative_pulse: 8,
  midday_check: 13,
  queue_sweep: 21.25,
  nightly_debrief: 21.5,
};

const BODY_FONT = "var(--font-body), Georgia, serif";
const SERIF_FONT = "var(--font-serif), Georgia, serif";
const DATA_FONT = "var(--font-data), 'Arial Narrow', sans-serif";

export default function HomePage() {
  const [deck, setDeck] = useState<Deck | null>(null);
  // The day's quote + greeting resolve AFTER mount: the server prerender
  // can't know this load's random quote or Cole's local hour, and the
  // mismatch caused a hydration error + content flash on every open.
  const [quote, setQuote] = useState<[string, string] | null>(null);
  const [hello, setHello] = useState("Welcome");
  useEffect(() => {
    setQuote(QUOTES[Math.floor(Math.random() * QUOTES.length)]!);
    setHello(greeting());
  }, []);
  const [today, setToday] = useState<TodayData | null>(null);
  const [ritualsLoaded, setRitualsLoaded] = useState(false);
  const [briefing, setBriefing] = useState<{ text: string; at: string } | null>(null);
  const [briefingOpen, setBriefingOpen] = useState(false);
  const [debrief, setDebrief] = useState<string | null>(null);
  const [debriefOpen, setDebriefOpen] = useState(false);
  const [overnightOpen, setOvernightOpen] = useState(false);
  const [receiptsOpen, setReceiptsOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [newTask, setNewTask] = useState("");
  // Honest failure (final council): a dead backend must NOT render as a calm
  // empty day, and a failed capture must never silently eat the thought.
  const [unreachable, setUnreachable] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [briefingBusy, setBriefingBusy] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const taskInputRef = useRef<HTMLInputElement | null>(null);
  // The windshield (alignment council): what's coming, not just what is.
  const [upnext, setUpnext] = useState<UpNext | null>(null);
  const [, setTick] = useState(0); // 60s re-render so countdowns stay honest
  useEffect(() => {
    fetch("/api/upnext")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j && !j.error && setUpnext(j))
      .catch(() => {});
    const t = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  // ── The Day Dial's feeds — best-effort, never load-bearing ──
  // Today's events from the CalendarEvent mirror (/api/calendar) and the
  // spine's day (/api/spine → ticks on the inner band + clean-nights streak).
  const [calEvents, setCalEvents] = useState<DialEvent[]>([]);
  const [calConfigured, setCalConfigured] = useState(false);
  const [spineTicks, setSpineTicks] = useState<SpineTick[]>([]);
  const [cleanNights, setCleanNights] = useState<number | null>(null);
  useEffect(() => {
    const d = new Date();
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const end = new Date(start.getTime() + 24 * 3600_000);
    fetch(`/api/calendar?from=${encodeURIComponent(start.toISOString())}&to=${encodeURIComponent(end.toISOString())}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!j || j.error) return;
        setCalConfigured(!!j.configured);
        const evs: DialEvent[] = (Array.isArray(j.events) ? j.events : [])
          .filter((e: any) => e?.startAt && e?.endAt && !(e?.raw?.allDay))
          .map((e: any) => ({
            startISO: String(e.startAt),
            endISO: String(e.endAt),
            title: String(e.title ?? ""),
            protected: /deep\s*work|focus|training/i.test(String(e.title ?? "")),
          }));
        setCalEvents(evs);
      })
      .catch(() => {});
    fetch("/api/spine")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!j || j.error || !Array.isArray(j.days) || !Array.isArray(j.runs)) return;
        const todayKey = j.days[j.days.length - 1];
        const status = new Map<string, string>();
        for (const r of j.runs) if (r?.day === todayKey && r?.jobName) status.set(r.jobName, r.status);
        const ticks: SpineTick[] = Object.entries(JOB_HOURS).map(([name, hour]) => {
          const st = status.get(name);
          return { hour, state: st === "done" ? "ran" : st === "failed" ? "fail" : "due" };
        });
        setSpineTicks(ticks);
        // Clean nights: consecutive days (newest back) that ran without a failure.
        let streak = 0;
        for (let i = j.days.length - 1; i >= 0; i--) {
          const runs = j.runs.filter((r: any) => r?.day === j.days[i]);
          if (runs.length > 0 && runs.every((r: any) => r.status !== "failed")) streak++;
          else break;
        }
        setCleanNights(streak);
      })
      .catch(() => {});
  }, []);

  // The promise ledger — best-effort, never load-bearing. Honest-empty:
  // no promises → the section simply doesn't exist.
  const [promises, setPromises] = useState<PromiseRow[]>([]);
  const [promiseBusy, setPromiseBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [d, t] = await Promise.all([
        fetch(`/api/deck?date=${localDate()}`),
        fetch(`/api/today?date=${localDate()}`),
      ]);
      if (d.ok) setDeck(await d.json());
      if (t.ok) setToday(await t.json());
      setUnreachable(!d.ok && !t.ok);
    } catch {
      setUnreachable(true);
    }
    fetch("/api/promises")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j && Array.isArray(j.promises) && setPromises(j.promises))
      .catch(() => {});
  }, []);

  const rulePromise = useCallback(async (id: string, status: "kept" | "dropped") => {
    if (promiseBusy) return;
    setPromiseBusy(id);
    try {
      const res = await fetch("/api/promises", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ op: "resolve", id, status }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setFlash(`Couldn't resolve that promise: ${j.error ?? "try again in a moment"}`);
      }
      await load();
    } catch {
      setFlash("Couldn't reach the brain — the promise stands.");
    } finally {
      setPromiseBusy(null);
    }
  }, [promiseBusy, load]);

  // A flashed error clears itself — one amber line, not a modal.
  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 5000);
    return () => clearTimeout(t);
  }, [flash]);

  // The home-screen "Capture a thought" shortcut lands on /home?focus=capture —
  // put the cursor in the task box so the shortcut actually captures.
  useEffect(() => {
    try {
      if (new URLSearchParams(window.location.search).get("focus") === "capture") {
        taskInputRef.current?.focus();
        taskInputRef.current?.scrollIntoView({ block: "center" });
      }
    } catch { /* prerender-safe */ }
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
      .catch(() => {})
      .finally(() => setRitualsLoaded(true));
  }, [load]);

  // "Brief me now" — a fresh deploy at noon has no briefing and no way to
  // summon one from the app (Telegram-only until the final council).
  const briefMe = useCallback(async () => {
    if (briefingBusy) return;
    setBriefingBusy(true);
    try {
      const res = await fetch("/api/rituals", { method: "POST" });
      if (res.ok) {
        const j = await res.json();
        if (j?.briefing) {
          setBriefing({ text: j.briefing, at: new Date().toISOString() });
          setBriefingOpen(true);
        }
      } else {
        setFlash("Couldn't build the briefing — is the backend awake?");
      }
    } catch {
      setFlash("Couldn't reach the brain for a briefing.");
    } finally {
      setBriefingBusy(false);
    }
  }, [briefingBusy]);

  // Returns success so callers (the capture box) can keep the input on failure.
  const act = useCallback(async (payload: Record<string, any>): Promise<boolean> => {
    try {
      const res = await fetch("/api/today/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: localDate(), ...payload }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setFlash(`Couldn't save that: ${j.error ?? "try again in a moment"}`);
        return false;
      }
      await load();
      return true;
    } catch {
      setFlash("Couldn't reach the brain — nothing was saved. Try again.");
      return false;
    }
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
  const receipts = deck?.bridgeReceipts ?? [];
  const overnight = deck?.overnight ?? [];
  const seenTasks = new Set<string>();
  const tasks = [...(today?.overdue ?? []), ...(today?.tasks ?? [])].filter((t) => {
    if (seenTasks.has(t.id)) return false;
    seenTasks.add(t.id);
    return true;
  });

  // The runway beside the dial — follow-through was fetched and unrendered.
  const followThrough = deck?.hero?.followThrough ?? null;
  const ft = useCountUp(followThrough ?? 0, 1100);

  // The dial's center + next-event line, from the windshield feed.
  const dialFreeHours = calConfigured ? upnext?.freeHours ?? null : null;
  const nextLabel = useMemo(() => {
    if (!upnext) return null;
    if (!upnext.nextEvent) return "CALENDAR CLEAR AHEAD";
    const when = upnext.nextEvent.allDay ? "ALL DAY" : untilLabel(upnext.nextEvent.startAt).toUpperCase();
    return `NEXT · ${upnext.nextEvent.title.slice(0, 24).toUpperCase()} · ${when}`;
  }, [upnext]);

  // The risk line may carry a fix on its own lines — main line burns amber,
  // the fix sits smaller beneath (same string, same builder, re-set in type).
  const riskCalm = deck?.biggestRisk?.startsWith("Nothing's on fire") ?? false;
  const riskLines = (deck?.biggestRisk ?? "").split("\n").filter((l) => l.trim().length > 0);

  return (
    <div className="au-horizon min-h-full">
      <div className="max-w-2xl mx-auto aurelius-reveal flex flex-col min-h-full relative" style={{ color: "var(--ink)" }}>
        {/* ── Above the fold: the day, in one breath ── */}
        <header className="text-center pt-2">
          {/* The engraved inscription — the greeting as carved letterform */}
          <h1
            style={{
              fontFamily: BODY_FONT, fontWeight: 600, fontSize: 14,
              letterSpacing: ".38em", textTransform: "uppercase",
              color: "var(--ink2)", margin: 0, paddingLeft: ".38em",
            }}
          >
            {hello}, Operator
          </h1>
          {/* The day's quote — the ritual survives the re-dress, directly beneath */}
          {quote && (
            <blockquote className="mt-4 max-w-xl mx-auto">
              <p className="au-kicker" style={{ display: "block", fontSize: "1.05rem", textAlign: "center" }}>
                “{quote[0]}”
              </p>
              <footer
                style={{
                  fontFamily: BODY_FONT, fontWeight: 600, fontSize: 11,
                  letterSpacing: ".26em", textTransform: "uppercase",
                  color: "var(--gold-dim)", marginTop: ".45rem",
                }}
              >
                — {quote[1]}
              </footer>
            </blockquote>
          )}
          {deck?.plan?.focus && (
            <p className="mt-3 text-sm" style={{ color: "var(--ink2)" }}>
              <span className="au-kicker" style={{ color: "var(--gold)", marginRight: 8 }}>focus —</span>
              {deck.plan.focus}
            </p>
          )}
        </header>

        {/* ── THE DAY DIAL + the runway ── */}
        <div className="flex justify-center items-center gap-10 flex-wrap mt-6">
          <DayDial events={calEvents} freeHours={dialFreeHours} nextLabel={nextLabel} spineTicks={spineTicks} />
          <div className="grid gap-4" style={{ minWidth: 200 }}>
            {followThrough != null && (
              <div>
                <b style={{ fontFamily: SERIF_FONT, fontWeight: 700, fontSize: "1.5rem", color: "var(--ink)", fontVariantNumeric: "tabular-nums" }}>
                  {Math.round(ft)}
                  <span style={{ fontFamily: BODY_FONT, fontSize: ".6em", color: "var(--gold)", letterSpacing: ".1em", fontWeight: 600 }}>%</span>
                </b>
                <span className="au-kicker" style={{ display: "block", marginTop: ".1rem" }}>follow-through</span>
              </div>
            )}
            <div>
              <b style={{ fontFamily: SERIF_FONT, fontWeight: 700, fontSize: "1.5rem", color: "var(--ink)", fontVariantNumeric: "tabular-nums" }}>
                {today?.doneToday ?? 0}
                <span style={{ fontFamily: BODY_FONT, fontSize: ".6em", color: "var(--gold)", letterSpacing: ".1em", fontWeight: 600 }}> done</span>
              </b>
              <span className="au-kicker" style={{ display: "block", marginTop: ".1rem" }}>
                {tasks.length} open on the board
              </span>
            </div>
            {upnext && (
              <span className="au-kicker" title="Aurelius's next scheduled move">
                ♛ {upnext.nextMove.tomorrow ? "tomorrow " : ""}{upnext.nextMove.time} {upnext.nextMove.label}
              </span>
            )}
          </div>
        </div>

        {/* ── The risk line — the one confrontation, resolving from blur ── */}
        {riskLines.length > 0 && (
          <p
            className="au-resolve"
            style={{
              maxWidth: 640, margin: "2.2rem auto 0", textAlign: "center",
              fontFamily: BODY_FONT, fontWeight: 500, fontStyle: "italic",
              fontSize: "clamp(1.2rem, 3vw, 1.5rem)", lineHeight: 1.6, letterSpacing: ".01em",
              color: riskCalm ? "var(--ink3)" : "var(--attn)",
            }}
          >
            {riskLines[0]}
            {riskLines.length > 1 && (
              <span style={{ display: "block", marginTop: ".5rem", fontStyle: "normal", fontSize: ".95rem", color: "var(--ink2)" }}>
                {riskLines.slice(1).join(" ")}
              </span>
            )}
          </p>
        )}

        <Divider />

        {/* No briefing yet (fresh boot, mid-day deploy) → offer to summon one */}
        {ritualsLoaded && !briefing && (
          <section>
            <button
              onClick={briefMe}
              disabled={briefingBusy}
              className="w-full text-left text-xs px-1 disabled:opacity-60"
              style={{ fontFamily: BODY_FONT, fontStyle: "italic", fontSize: 13.5, color: "var(--ink3)" }}
            >
              {briefingBusy ? "✦ Composing the briefing…" : "✦ No briefing yet today — brief me now"}
            </button>
          </section>
        )}

        {/* Briefing — open when fresh, one quiet line once read */}
        {briefing && (
          <section className="mt-2">
            {briefingOpen ? (
              <Panel
                tier="card"
                label="Morning briefing"
                labelGold
                headerRight={
                  <button className="au-undo" style={{ marginLeft: 0 }} onClick={() => setBriefingOpen(false)}>
                    collapse
                  </button>
                }
              >
                <p className="text-sm whitespace-pre-wrap leading-relaxed" style={{ color: "var(--ink2)" }}>{briefing.text}</p>
              </Panel>
            ) : (
              <button
                onClick={() => setBriefingOpen(true)}
                className="w-full text-left text-xs px-1"
                style={{ fontFamily: BODY_FONT, fontStyle: "italic", fontSize: 13.5, color: "var(--ink3)" }}
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
              <Panel
                tier="card"
                label="Evening debrief"
                labelGold
                headerRight={
                  <button className="au-undo" style={{ marginLeft: 0 }} onClick={() => setDebriefOpen(false)}>
                    collapse
                  </button>
                }
              >
                <p className="text-sm whitespace-pre-wrap leading-relaxed" style={{ color: "var(--ink2)" }}>{debrief}</p>
              </Panel>
            ) : (
              <button
                onClick={() => setDebriefOpen(true)}
                className="w-full text-left text-xs px-1"
                style={{ fontFamily: BODY_FONT, fontStyle: "italic", fontSize: 13.5, color: "var(--ink3)" }}
              >
                ☾ The day's debrief is in — tap to read
              </button>
            )}
          </section>
        )}

        {/* Needs-you — THE inscription tablet; renders NOTHING when nothing needs him */}
        {bridge.length > 0 && (
          <Panel tier="glass" labelGold label={<>Needs you · {roman(bridge.length)}</>} className="mt-6">
            <div className="space-y-5">
              {bridge.slice(0, 3).map((s) => (
                <div key={s.id}>
                  <p className="text-sm font-medium" style={{ color: SEV_INK[s.severity] ?? "var(--ink)" }}>{s.title}</p>
                  {s.body && (
                    <p className="text-xs mt-1 line-clamp-3 whitespace-pre-wrap" style={{ color: "var(--ink3)" }}>{s.body}</p>
                  )}
                  <div className="flex gap-2 mt-2.5 flex-wrap items-center">
                    {confirmable(s) && (
                      <Btn onClick={() => rule("/api/autonomy/confirm", s.id)} disabled={busy === s.id}>
                        {busy === s.id ? "…" : "Confirm & do it"}
                      </Btn>
                    )}
                    {undoable(s) && (
                      <Btn ghost onClick={() => rule("/api/autonomy/undo", s.id)} disabled={busy === s.id}>
                        Undo
                      </Btn>
                    )}
                    <Btn ghost onClick={() => act({ action: "ackSignal", id: s.id, status: "acknowledged" })}>
                      Got it
                    </Btn>
                    <button
                      onClick={() => act({ action: "ackSignal", id: s.id, status: "dismissed" })}
                      className="text-xs px-2"
                      style={{ fontFamily: BODY_FONT, fontWeight: 600, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--ink3)" }}
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              ))}
            </div>
            {bridge.length > 3 && (
              <a href="/decisions" className="block text-xs mt-4" style={{ color: "var(--ink3)" }}>
                +{bridge.length - 3} more on Decisions →
              </a>
            )}
          </Panel>
        )}

        {/* ── THE NIGHT LEDGER — proof of the night shift, verb-first ── */}
        {overnight.length > 0 && (
          <section className="mt-8">
            <div className="flex items-baseline justify-between gap-4 flex-wrap">
              <button
                onClick={() => setOvernightOpen((o) => !o)}
                className="au-label-row"
                style={{ color: "var(--gold)", background: "none", border: 0, cursor: "pointer", padding: 0, textAlign: "left" }}
              >
                <Tick /> While you slept — {overnight.length} act{overnight.length === 1 ? "" : "s"}, all reversible{" "}
                <span style={{ color: "var(--ink3)" }}>{overnightOpen ? "· hide" : "· see"}</span>
              </button>
              {cleanNights != null && cleanNights >= 2 && (
                <span className="au-kicker" style={{ color: "var(--gold)" }}>
                  clean nights · {cleanNights} in a row
                </span>
              )}
            </div>
            {overnightOpen && (
              <div>
                <div className="au-rule" style={{ marginBottom: 0 }} />
                {overnight.map((s) => (
                  <LedgerRow
                    key={s.id}
                    tick="em"
                    verb={s.title}
                    obj={s.kind.replace(/_/g, " ")}
                    onUndo={undoable(s) ? () => rule("/api/autonomy/undo", s.id) : undefined}
                  />
                ))}
                <a href="/aurelius?tab=autonomy" className="block text-[11px] pt-2" style={{ color: "var(--ink3)" }}>
                  all autonomous actions →
                </a>
              </div>
            )}
          </section>
        )}

        {/* Receipts that landed "pending" but need no ruling — kept OUT of the
            needs-you tablet and off the bell, collapsed to a count of their own. */}
        {receipts.length > 0 && (
          <section className="mt-4">
            <button
              onClick={() => setReceiptsOpen((o) => !o)}
              className="text-xs px-1"
              style={{ fontFamily: BODY_FONT, fontStyle: "italic", fontSize: 13.5, color: "var(--ink3)" }}
            >
              ℹ {receipts.length} update{receipts.length === 1 ? "" : "s"}, nothing to decide{" "}
              {receiptsOpen ? "· hide" : "· see"}
            </button>
            {receiptsOpen && (
              <div className="mt-1">
                {receipts.map((s) => (
                  <LedgerRow
                    key={s.id}
                    tick="hollow"
                    verb={s.title}
                    obj={s.kind.replace(/_/g, " ")}
                    right={
                      <button className="au-undo" onClick={() => act({ action: "ackSignal", id: s.id, status: "acknowledged" })}>
                        got it
                      </button>
                    }
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {/* ── LEDGER OF PROMISES — the smallest unit of trust. Gold tick =
            Cole owes it; hollow = he's waiting on it. Honest-empty: no
            promises, no section. ── */}
        {promises.length > 0 && (
          <section className="mt-6">
            <SectionLabel row>Ledger of promises</SectionLabel>
            <div className="mt-1">
              {promises.map((p) => (
                <LedgerRow
                  key={p.id}
                  tick={p.direction === "owed_by_cole" ? "gold" : "hollow"}
                  verb={
                    <>
                      {p.text}
                      {promiseDueLabel(p) && (
                        <span
                          style={{
                            marginLeft: 8,
                            fontSize: 11,
                            letterSpacing: ".08em",
                            textTransform: "uppercase",
                            color: p.status === "lapsed" ? "var(--attn)" : "var(--ink3)",
                          }}
                        >
                          {promiseDueLabel(p)}
                        </span>
                      )}
                    </>
                  }
                  obj={p.direction === "owed_by_cole" ? `→ ${p.counterpart}` : `waiting on ${p.counterpart}`}
                  right={
                    <span className="flex gap-2 shrink-0">
                      <button
                        className="au-undo"
                        disabled={promiseBusy === p.id}
                        onClick={() => rulePromise(p.id, "kept")}
                        title="Mark kept"
                      >
                        {promiseBusy === p.id ? "…" : "kept"}
                      </button>
                      <button
                        className="au-undo"
                        disabled={promiseBusy === p.id}
                        onClick={() => rulePromise(p.id, "dropped")}
                        title="Drop it (deliberately let go)"
                      >
                        dropped
                      </button>
                    </span>
                  }
                />
              ))}
            </div>
          </section>
        )}

        <Divider />

        {/* ── One scroll down: today's board ── */}
        <section>
          <div className="flex items-baseline justify-between gap-4 flex-wrap px-1">
            <SectionLabel row>Today&apos;s board</SectionLabel>
            <span style={{ fontFamily: DATA_FONT, fontSize: 11.5, letterSpacing: ".06em", color: "var(--ink3)", fontVariantNumeric: "tabular-nums" }}>
              {today ? `${today.doneToday} done · ${tasks.length} open` : ""}
            </span>
          </div>
          <ul className="mt-1">
            {tasks.map((t) => (
              <li key={t.id} className="au-lrow">
                <button
                  onClick={() => act({ action: "completeTask", id: t.id })}
                  className={`relative after:absolute after:-inset-3 after:content-[''] w-4 h-4 border rounded-sm shrink-0 ${
                    t.status === "overdue" || (today?.overdue ?? []).some((o) => o.id === t.id)
                      ? "border-red-400 hover:bg-red-400/30"
                      : "border-aurelius-gold hover:bg-aurelius-gold/40"
                  }`}
                  title="Done"
                />
                <span className="au-verb text-sm flex-1 truncate">
                  {t.priority === "high" && <span style={{ color: "var(--gold)" }} className="mr-1.5">!</span>}
                  {t.title}
                </span>
                {t.domain && <span className="au-obj" style={{ fontSize: 13 }}>{t.domain}</span>}
              </li>
            ))}
            {tasks.length === 0 && (
              <li className="italic text-sm px-1 py-2" style={{ color: unreachable ? "var(--attn)" : "var(--ink3)", fontFamily: BODY_FONT }}>
                {unreachable ? "Couldn't reach the brain — this may not be the whole picture." : "Nothing on deck."}
              </li>
            )}
          </ul>
          <div className="au-chatbar mt-4">
            <input
              ref={taskInputRef}
              value={newTask}
              onChange={(e) => setNewTask(e.target.value)}
              onKeyDown={async (e) => {
                if (e.key === "Enter" && newTask.trim() && !capturing) {
                  // Clear ONLY on confirmed save — a failed capture keeps the
                  // text; the in-flight guard stops double-Enter on a slow
                  // network from filing the task twice (post-sweep council).
                  setCapturing(true);
                  try {
                    const title = newTask.trim();
                    if (await act({ action: "createTask", title, status: "today" })) setNewTask("");
                  } finally {
                    setCapturing(false);
                  }
                }
              }}
              placeholder="Add a task for today…"
              aria-label="Add a task for today"
            />
          </div>
          {flash && <p className="text-xs mt-2 px-1" style={{ color: "var(--attn)" }}>{flash}</p>}
          {(today?.habits ?? []).length > 0 && (
            <div className="flex flex-wrap gap-2 mt-4 justify-center">
              {(today?.habits ?? []).map((h) => (
                <button
                  key={h.id}
                  onClick={() => !h.doneToday && act({ action: "completeHabit", id: h.id })}
                  className="text-xs rounded-full px-3 py-1.5 border min-h-[32px]"
                  style={
                    h.doneToday
                      ? { borderColor: "var(--gold)", background: "rgba(212,175,55,.16)", color: "var(--gold)" }
                      : { borderColor: "var(--gold-line)", color: "var(--ink2)" }
                  }
                >
                  {h.doneToday ? "✓ " : ""}
                  {h.name}
                  {h.streak > 1 && <span style={{ opacity: 0.7 }}> · {h.streak}</span>}
                </button>
              ))}
            </div>
          )}
        </section>

        <Divider capital />

        {/* ── The spine: talk to Aurelius (One Box lands fully in UX-PR6) ── */}
        <section className="mt-2 flex-1 flex flex-col">
          <AureliusChat />
        </section>
      </div>
    </div>
  );
}
