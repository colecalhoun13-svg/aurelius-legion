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

// A fresh quote every load — the persona's warrior-philosopher lineage
// (aureliusPersona.ts): tested through action, written with brutal economy.
const QUOTES: [string, string][] = [
  ["You have power over your mind — not outside events. Realize this, and you will find strength.", "Marcus Aurelius"],
  ["Waste no more time arguing about what a good man should be. Be one.", "Marcus Aurelius"],
  ["The impediment to action advances action. What stands in the way becomes the way.", "Marcus Aurelius"],
  ["If it is not right, do not do it; if it is not true, do not say it.", "Marcus Aurelius"],
  ["Confine yourself to the present.", "Marcus Aurelius"],
  ["The best revenge is to be unlike him who performed the injury.", "Marcus Aurelius"],
  ["Very little is needed to make a happy life; it is all within yourself, in your way of thinking.", "Marcus Aurelius"],
  ["It is not death that a man should fear, but he should fear never beginning to live.", "Marcus Aurelius"],
  ["We suffer more often in imagination than in reality.", "Seneca"],
  ["Luck is what happens when preparation meets opportunity.", "Seneca"],
  ["He who is brave is free.", "Seneca"],
  ["Begin at once to live, and count each separate day as a separate life.", "Seneca"],
  ["It is a rough road that leads to the heights of greatness.", "Seneca"],
  ["No man is free who is not master of himself.", "Epictetus"],
  ["First say to yourself what you would be; and then do what you have to do.", "Epictetus"],
  ["It's not what happens to you, but how you react to it that matters.", "Epictetus"],
  ["Don't explain your philosophy. Embody it.", "Epictetus"],
  ["The greater the difficulty, the more glory in surmounting it.", "Epictetus"],
  ["Dwell on the beauty of life. Watch the stars, and see yourself running with them.", "Marcus Aurelius"],
  ["Think of yourself as dead. You have lived your life. Now take what's left and live it properly.", "Marcus Aurelius"],
  ["When you arise in the morning, think of what a precious privilege it is to be alive.", "Marcus Aurelius"],
  ["In the midst of chaos, there is also opportunity.", "Sun Tzu"],
  ["The supreme art of war is to subdue the enemy without fighting.", "Sun Tzu"],
  ["Victorious warriors win first and then go to war.", "Sun Tzu"],
  ["Do nothing that is of no use.", "Miyamoto Musashi"],
  ["You must understand that there is more than one path to the top of the mountain.", "Miyamoto Musashi"],
  ["Today is victory over yourself of yesterday.", "Miyamoto Musashi"],
  ["Nature does not hurry, yet everything is accomplished.", "Lao Tzu"],
  ["A journey of a thousand miles begins with a single step.", "Lao Tzu"],
  ["Mastering others is strength. Mastering yourself is true power.", "Lao Tzu"],
  ["Character is destiny.", "Heraclitus"],
  ["No man ever steps in the same river twice.", "Heraclitus"],
  ["There is surely nothing other than the single purpose of the present moment.", "Hagakure"],
]



const QUICK_LINKS = [
  { name: "Today", path: "/today", glyph: "☀", desc: "plan · tasks · capture" },
  { name: "Projects", path: "/projects", glyph: "❖", desc: "progress · runway" },
  { name: "Goals", path: "/goals", glyph: "◎", desc: "big & small" },
  { name: "Bridge", path: "/bridge", glyph: "⇄", desc: "signals from Aurelius" },
  { name: "Aurelius", path: "/aurelius", glyph: "❂", desc: "background work" },
];

export default function DeckPage() {
  const [deck, setDeck] = useState<Deck | null>(null);
  const [quote] = useState(() => QUOTES[Math.floor(Math.random() * QUOTES.length)]!);
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

      {/* The day's quote */}
      <blockquote className="mt-6 max-w-2xl px-8 text-center">
        <p className="italic text-neutral-400 leading-relaxed" style={{ fontFamily: "Georgia, serif" }}>
          “{quote[0]}”
        </p>
        <footer className="aurelius-heading text-sm mt-2">— {quote[1]}</footer>
      </blockquote>

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
