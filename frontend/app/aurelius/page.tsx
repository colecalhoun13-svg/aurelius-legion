"use client";

// AURELIUS — what the system is doing in the background.
// Activity counts, compiled patterns, research memory, the pulse.

import { useCallback, useEffect, useState } from "react";

type Activity = {
  counts: { memories24h: number; reasoningRuns24h: number };
  recentPatterns: { patternType: string; status: string; supportCount: number; domain: string }[];
  recentResearch: { summary: string; at?: string }[];
  recentSignals: { kind: string; severity: string; title: string; status: string }[];
};

export default function AureliusPage() {
  const [activity, setActivity] = useState<Activity | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/deck");
    if (res.ok) setActivity((await res.json()).activity);
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 30000); // live-ish
    return () => clearInterval(t);
  }, [load]);

  return (
    <main className="text-aurelius-text max-w-3xl mx-auto space-y-6">
      <header className="flex items-baseline justify-between border-b border-aurelius-gold/35 pb-3">
        <h1 className="aurelius-heading text-4xl">Aurelius</h1>
        <span className="flex items-center gap-2 text-sm text-neutral-500">
          <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
          pulse armed
        </span>
      </header>

      <div className="grid grid-cols-2 gap-4">
        <div className="aurelius-panel-frame p-6 text-center">
          <div className="text-4xl text-aurelius-gold font-semibold drop-shadow-[0_0_14px_rgba(212,175,55,0.3)]">
            {activity?.counts.memories24h ?? "—"}
          </div>
          <div className="text-[11px] uppercase tracking-widest text-neutral-500 mt-2">Memories written · 24h</div>
        </div>
        <div className="aurelius-panel-frame p-6 text-center">
          <div className="text-4xl text-aurelius-gold font-semibold drop-shadow-[0_0_14px_rgba(212,175,55,0.3)]">
            {activity?.counts.reasoningRuns24h ?? "—"}
          </div>
          <div className="text-[11px] uppercase tracking-widest text-neutral-500 mt-2">Reasoning runs · 24h</div>
        </div>
      </div>

      <section className="aurelius-panel-frame p-6">
        <h2 className="aurelius-heading text-lg mb-3">Compiled Patterns</h2>
        {(activity?.recentPatterns ?? []).length === 0 ? (
          <p className="text-neutral-600 italic text-sm">Nothing compiled yet — patterns emerge as situations repeat. This is how Aurelius learns to lean on the LLM less.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {activity!.recentPatterns.map((p, i) => (
              <li key={i} className="text-neutral-300">
                <span className="text-aurelius-gold">{p.patternType}</span> · {p.domain} · seen {p.supportCount}×
                <span className="text-neutral-500 text-xs ml-2">({p.status.replace(/_/g, " ")})</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="aurelius-panel-frame p-6">
        <h2 className="aurelius-heading text-lg mb-3">Research Memory</h2>
        {(activity?.recentResearch ?? []).length === 0 ? (
          <p className="text-neutral-600 italic text-sm">The weekend pass runs Sundays 09:00 — findings and knowledge proposals land here for Monday review.</p>
        ) : (
          <ul className="space-y-2.5 text-sm text-neutral-400">
            {activity!.recentResearch.map((r, i) => <li key={i}>• {r.summary}</li>)}
          </ul>
        )}
      </section>

      <section className="aurelius-panel-frame p-6">
        <h2 className="aurelius-heading text-lg mb-3">The Pulse</h2>
        <ul className="text-sm text-neutral-400 space-y-1.5">
          <li>• <span className="text-neutral-300">Nightly close-out</span> — 21:30 · computes intent-vs-action, surfaces the gap</li>
          <li>• <span className="text-neutral-300">Weekend research</span> — Sun 09:00 · ingests the field, proposes knowledge updates</li>
        </ul>
        <p className="text-xs text-neutral-600 mt-3">Schedules run inside the backend server. More loops arrive with the autonomy engine.</p>
      </section>
    </main>
  );
}
