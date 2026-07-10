"use client";

export default function TopBar() {
  return (
    <header className="w-full h-16 border-b border-aurelius-gold/40 bg-black/70 flex items-center gap-4 px-5">
      {/* Command bar — per the mockup's search field */}
      <div className="flex-1 flex items-center gap-3 border border-aurelius-gold/30 rounded px-4 h-9 bg-black/60">
        <span className="text-aurelius-gold/60 text-sm">⌕</span>
        <input
          className="flex-1 bg-transparent outline-none text-sm text-aurelius-text placeholder:text-neutral-600"
          placeholder="Search…"
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
