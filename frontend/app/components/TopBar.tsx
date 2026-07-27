"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useNeedsYou } from "../../lib/useNeedsYou";

// The ⌘K bar is dual-mode: type a destination's name (or an old name — the
// aliases remember "wiki", "inbox", "library") and Enter jumps there; type a
// real question and Enter asks the second brain, exactly as before. This is
// the contract that makes every nested tab one keystroke away.
const DESTINATIONS: Array<{ name: string; path: string; glyph: string; alias: string }> = [
  { name: "Home", path: "/home", glyph: "❂", alias: "today deck day plan" },
  { name: "Decisions", path: "/decisions", glyph: "⇄", alias: "signals bridge needs you" },
  { name: "Triage", path: "/decisions?tab=triage", glyph: "⇄", alias: "inbox review" },
  { name: "Calendar", path: "/calendar", glyph: "◷", alias: "week schedule" },
  { name: "Goals & Projects", path: "/goals", glyph: "◎", alias: "progress" },
  { name: "Scoreboard", path: "/goals?tab=scoreboard", glyph: "◎", alias: "stats trends charts dashboard follow-through" },
  { name: "Brain · Shelves", path: "/brain", glyph: "❈", alias: "library books sources reader" },
  { name: "Brain · Ask", path: "/brain?tab=ask", glyph: "❈", alias: "corpus recall" },
  { name: "Brain · Syntheses", path: "/brain?tab=wiki", glyph: "❈", alias: "wiki" },
  { name: "Aurelius · Missions", path: "/aurelius", glyph: "♛", alias: "missions background pulse" },
  { name: "Aurelius · Autonomy", path: "/aurelius?tab=autonomy", glyph: "♛", alias: "dial keyholes grant undo" },
  { name: "Aurelius · Traces", path: "/aurelius?tab=traces", glyph: "♛", alias: "logs debug threads" },
  { name: "Tools", path: "/tools", glyph: "⚒", alias: "integrations" },
  { name: "Engines", path: "/engines", glyph: "⚙", alias: "models" },
  { name: "Settings", path: "/settings", glyph: "✦", alias: "connect google gmail instagram" },
  { name: "Chat console", path: "/console", glyph: "❯", alias: "conversation" },
];

export default function TopBar() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [sel, setSel] = useState(0);
  const needsYou = useNeedsYou();

  // ⌘K / Ctrl+K focuses the ask bar from anywhere
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const q = query.trim().toLowerCase();
  // Short queries are navigation; sentences are questions. A real question
  // ("what's on my calendar friday") must never hijack Enter into a nav jump.
  const navigable = q.length > 0 && q.length <= 20 && q.split(/\s+/).length <= 2;
  const matches = navigable
    ? DESTINATIONS.filter((d) => `${d.name} ${d.alias}`.toLowerCase().includes(q)).slice(0, 6)
    : [];
  const rows: Array<{ kind: "nav"; name: string; path: string; glyph: string } | { kind: "ask" }> = [
    ...matches.map((m) => ({ kind: "nav" as const, name: m.name, path: m.path, glyph: m.glyph })),
    { kind: "ask" },
  ];
  const open = focused && q.length > 0;
  const selClamped = Math.min(sel, rows.length - 1);

  const ask = () => {
    const text = query.trim();
    if (!text) return;
    setQuery("");
    inputRef.current?.blur();
    router.push(`/brain?ask=${encodeURIComponent(text)}`);
  };

  const run = (row: (typeof rows)[number]) => {
    if (row.kind === "ask") return ask();
    setQuery("");
    inputRef.current?.blur();
    router.push(row.path);
  };

  const onInputKey = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === "Enter") ask();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSel((s) => (s + 1) % rows.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSel((s) => (s - 1 + rows.length) % rows.length);
    } else if (e.key === "Enter") {
      run(rows[selClamped]);
    } else if (e.key === "Escape") {
      inputRef.current?.blur();
    }
  };

  return (
    <header className="w-full h-16 border-b border-aurelius-gold/40 bg-black/70 flex items-center gap-4 px-5">
      {/* Ask bar — jump anywhere, or route any question into the second brain */}
      <div className="flex-1 relative">
        <div className="flex items-center gap-3 border border-aurelius-gold/30 rounded px-4 h-9 bg-black/60 focus-within:border-aurelius-gold/60">
          <span className="text-aurelius-gold/60 text-sm">⌕</span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSel(0);
            }}
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 150)}
            onKeyDown={onInputKey}
            className="flex-1 bg-transparent outline-none text-sm text-aurelius-text placeholder:text-neutral-600"
            placeholder="Jump anywhere, or ask the second brain…"
          />
          <span className="hidden md:inline text-[11px] text-aurelius-gold/70 border border-aurelius-gold/30 rounded px-1.5 py-0.5 tracking-wide">
            CMD ⌘ K
          </span>
        </div>

        {open && (
          <div className="absolute left-0 right-0 top-10 z-50 border border-aurelius-gold/40 rounded-lg bg-black/95 backdrop-blur shadow-[0_8px_30px_rgba(0,0,0,0.8)] overflow-hidden">
            {rows.map((row, i) => (
              <button
                key={row.kind === "nav" ? row.path : "__ask"}
                onMouseDown={(e) => {
                  e.preventDefault();
                  run(row);
                }}
                onMouseEnter={() => setSel(i)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm ${
                  i === selClamped ? "bg-aurelius-gold/15 text-aurelius-gold" : "text-neutral-300"
                }`}
              >
                {row.kind === "nav" ? (
                  <>
                    <span className="text-aurelius-gold/60 w-5 text-center">{row.glyph}</span>
                    <span className="flex-1">{row.name}</span>
                    <span className="text-[10px] uppercase tracking-widest text-neutral-600">jump</span>
                  </>
                ) : (
                  <>
                    <span className="text-aurelius-gold/60 w-5 text-center">❈</span>
                    <span className="flex-1 truncate">
                      Ask the second brain — <span className="text-neutral-500">“{query.trim()}”</span>
                    </span>
                    <span className="text-[10px] uppercase tracking-widest text-neutral-600">ask</span>
                  </>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* The bell is live: what awaits Cole's ruling, counted. */}
      <button
        onClick={() => router.push("/decisions")}
        className="relative text-aurelius-gold text-lg leading-none hover:drop-shadow-[0_0_6px_rgba(212,175,55,0.6)] min-w-[44px] min-h-[44px] -my-2"
        title="What needs you — Decisions"
      >
        🔔
        {needsYou > 0 && (
          <span className="absolute top-1 right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-aurelius-gold text-black text-[11px] font-bold leading-[18px] text-center">
            {needsYou > 9 ? "9+" : needsYou}
          </span>
        )}
      </button>
    </header>
  );
}
