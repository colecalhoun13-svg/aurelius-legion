"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export default function TopBar() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");

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

  const submit = () => {
    const q = query.trim();
    if (!q) return;
    setQuery("");
    inputRef.current?.blur();
    router.push(`/corpus?ask=${encodeURIComponent(q)}`);
  };

  return (
    <header className="w-full h-16 border-b border-aurelius-gold/40 bg-black/70 flex items-center gap-4 px-5">
      {/* Ask bar — routes any question into the second brain */}
      <div className="flex-1 flex items-center gap-3 border border-aurelius-gold/30 rounded px-4 h-9 bg-black/60 focus-within:border-aurelius-gold/60">
        <span className="text-aurelius-gold/60 text-sm">⌕</span>
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          className="flex-1 bg-transparent outline-none text-sm text-aurelius-text placeholder:text-neutral-600"
          placeholder="Ask the second brain…"
        />
        <span className="text-[11px] text-aurelius-gold/70 border border-aurelius-gold/30 rounded px-1.5 py-0.5 tracking-wide">
          CMD ⌘ K
        </span>
      </div>

      <button className="text-aurelius-gold text-lg leading-none hover:drop-shadow-[0_0_6px_rgba(212,175,55,0.6)]" title="Notifications">
        🔔
      </button>
      <button className="text-aurelius-gold text-lg leading-none hover:drop-shadow-[0_0_6px_rgba(212,175,55,0.6)]" title="Settings">
        ⚙
      </button>
    </header>
  );
}
