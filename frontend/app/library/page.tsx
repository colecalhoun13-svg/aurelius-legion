"use client";

// THE LIBRARY — what each operator has studied, and what it's studying next.
// The curriculum feeds the second brain + wiki; this is the shelf Cole can watch
// fill week over week, and steer (study a field now).

import { useCallback, useEffect, useState } from "react";

type Shelf = { domain: string; label: string; read: number; total: number; discovered: number; cycles: number };
type Recent = { id: string; title: string; domain: string; createdAt: string };
type Library = { progress: Shelf[]; recent: Recent[] };

export default function LibraryPage() {
  const [lib, setLib] = useState<Library | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/library");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setLib(await res.json());
    } catch (e: any) {
      setErr(e?.message ?? "failed to load");
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const studyNow = useCallback(async (domain: string) => {
    if (busy) return;
    setBusy(domain);
    try {
      const res = await fetch("/api/library", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) window.alert(`Couldn't study: ${j.error ?? res.status}`);
      else if ((j.studied?.length ?? 0) === 0) {
        window.alert(j.skipped?.[0]?.reason ? `Nothing studied — ${j.skipped[0].reason}` : "Nothing studied (no engine?).");
      }
      await load();
    } finally {
      setBusy(null);
    }
  }, [busy, load]);

  const totalRead = lib?.progress.reduce((n, s) => n + s.read, 0) ?? 0;

  return (
    <main className="text-aurelius-text max-w-3xl mx-auto space-y-6 aurelius-stagger">
      <header className="flex items-baseline justify-between aurelius-rule">
        <h1 className="aurelius-heading text-4xl">The Library</h1>
        <span className="text-sm text-neutral-500">{lib === null ? "…" : `${totalRead} studied`}</span>
      </header>
      <p className="text-sm text-neutral-500">
        What each operator has read and understood — works and the concepts of the field itself. It studies the next
        unit every Sunday, grows its own reading list, and distills what it learns into principles you confirm.
      </p>

      {err && <p className="text-red-400 text-sm">Couldn't load: {err}</p>}

      {/* The shelves */}
      <section className="space-y-3">
        {(lib?.progress ?? []).map((s) => {
          const pct = s.total > 0 ? Math.round((s.read / s.total) * 100) : 0;
          return (
            <div key={s.domain} className="aurelius-panel-frame p-4 border border-aurelius-gold/20">
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium text-sm">{s.label}</span>
                <span className="flex items-center gap-3 shrink-0">
                  <span className="text-[11px] text-neutral-500">
                    {s.read}/{s.total}
                    {s.discovered > 0 && <span className="text-aurelius-gold/60"> · +{s.discovered} discovered</span>}
                    {s.cycles > 0 && <span className="text-neutral-600"> · {s.cycles}× deepened</span>}
                  </span>
                  <button
                    onClick={() => studyNow(s.domain)}
                    disabled={busy === s.domain}
                    className="text-xs border border-aurelius-gold/40 rounded-lg px-3 py-1 hover:bg-aurelius-gold/15 text-aurelius-gold disabled:opacity-50"
                  >
                    {busy === s.domain ? "Studying…" : "Study now"}
                  </button>
                </span>
              </div>
              <div className="mt-2 h-1.5 w-full rounded bg-neutral-800 overflow-hidden">
                <div className="h-full bg-aurelius-gold/70" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </section>

      {/* Recently studied */}
      {lib?.recent && lib.recent.length > 0 && (
        <section>
          <h2 className="aurelius-heading text-lg mb-2">Recently studied</h2>
          <ul className="space-y-1.5">
            {lib.recent.map((r) => (
              <li key={r.id} className="text-xs text-neutral-500 flex items-start gap-2 px-1">
                <span className="text-aurelius-gold/60 mt-px">✦</span>
                <span>
                  <span className="text-neutral-400">{r.title}</span>
                  <span className="text-neutral-600"> · {new Date(r.createdAt).toLocaleDateString([], { month: "short", day: "numeric" })}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
