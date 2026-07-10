"use client";

// COMMAND DECK — the landing. Deliberately near-blank: the wreath, a
// greeting, today's focus, one quiet vitals row, and a command line.
// Everything else lives on its own page. Calm surface, depth one click away.

import { useCallback, useEffect, useState } from "react";

type Deck = {
  date: string;
  hero: {
    overdue: number;
    doneToday: number;
    openToday: number;
    followThrough: number | null;
    attentionSignals: number;
  };
  plan: { focus: string | null } | null;
};

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

const QUICK_LINKS = [
  { name: "Today", path: "/today", glyph: "☀", desc: "plan · tasks · capture" },
  { name: "Projects", path: "/projects", glyph: "❖", desc: "progress · runway" },
  { name: "Goals", path: "/goals", glyph: "◎", desc: "big & small" },
  { name: "Bridge", path: "/bridge", glyph: "⇄", desc: "signals from Aurelius" },
  { name: "Aurelius", path: "/aurelius", glyph: "❂", desc: "background work" },
];

export default function DeckPage() {
  const [deck, setDeck] = useState<Deck | null>(null);
  const [cmd, setCmd] = useState("");
  const [flash, setFlash] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/deck?date=${localDate()}`);
      if (res.ok) setDeck(await res.json());
    } catch { /* landing stays calm even if the backend is down */ }
  }, []);

  useEffect(() => { load(); }, [load]);

  const submit = useCallback(async (asCapture: boolean) => {
    const text = cmd.trim();
    if (!text) return;
    setCmd("");
    await fetch("/api/today/actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        asCapture
          ? { action: "capture", content: text, date: localDate() }
          : { action: "createTask", title: text, status: "today", date: localDate() }
      ),
    });
    setFlash(asCapture ? "Captured." : "On the deck for today.");
    setTimeout(() => setFlash(null), 2200);
    await load();
  }, [cmd, load]);

  const h = deck?.hero;

  return (
    <main className="h-full flex flex-col items-center justify-center text-aurelius-text -mt-6">
      {/* The greeting */}
      <h1 className="aurelius-heading text-5xl md:text-6xl text-center">
        {greeting()}, Operator
      </h1>
      <p className="text-neutral-500 text-sm mt-3">{deck?.date ?? ""}</p>

      {/* Focus, if set — a single quiet line */}
      {deck?.plan?.focus && (
        <p className="mt-6 text-lg text-neutral-300 max-w-xl text-center leading-snug">
          <span className="text-aurelius-gold/70 aurelius-heading text-sm mr-2">Focus</span>
          {deck.plan.focus}
        </p>
      )}

      {/* Command line */}
      <div className="mt-10 w-full max-w-xl px-6">
        <div className="aurelius-panel-frame flex items-center gap-3 px-5 py-3.5">
          <span className="text-aurelius-gold/70">❯</span>
          <input
            value={cmd}
            onChange={(e) => setCmd(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") submit(e.shiftKey); }}
            placeholder="What needs doing?"
            className="flex-1 bg-transparent outline-none placeholder:text-neutral-600"
            autoFocus
          />
        </div>
        <div className="flex items-center justify-between mt-2 px-1 text-xs text-neutral-600">
          <span>Enter → task for today · Shift+Enter → capture a thought</span>
          {flash && <span className="text-aurelius-gold">{flash}</span>}
        </div>
      </div>

      {/* Vitals — one quiet row */}
      {h && (
        <div className="mt-10 flex gap-8 text-center">
          {[
            { label: "overdue", value: h.overdue, alarm: h.overdue > 0 },
            { label: "open", value: h.openToday },
            { label: "done", value: h.doneToday },
            { label: "follow-through", value: h.followThrough !== null ? `${h.followThrough}%` : "—", alarm: h.followThrough !== null && h.followThrough < 50 },
            { label: "attention", value: h.attentionSignals, alarm: h.attentionSignals > 0 },
          ].map((t) => (
            <div key={t.label}>
              <div className={`text-xl font-semibold ${t.alarm ? "text-red-400" : "text-aurelius-gold"}`}>{t.value}</div>
              <div className="text-[10px] uppercase tracking-widest text-neutral-600 mt-0.5">{t.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Doors to the real pages */}
      <div className="mt-12 flex flex-wrap justify-center gap-3 px-6">
        {QUICK_LINKS.map((l) => (
          <a key={l.path} href={l.path}
            className="aurelius-panel-frame aurelius-card px-5 py-3 flex items-center gap-3 no-underline">
            <span className="text-aurelius-gold text-lg">{l.glyph}</span>
            <span>
              <span className="block text-sm text-aurelius-text">{l.name}</span>
              <span className="block text-[10px] uppercase tracking-wider text-neutral-600">{l.desc}</span>
            </span>
          </a>
        ))}
      </div>
    </main>
  );
}
