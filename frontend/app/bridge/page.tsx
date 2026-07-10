"use client";

// THE BRIDGE — where Aurelius's background work meets Cole.
// Every signal, full body, inline actions.

import { useCallback, useEffect, useState } from "react";

type Signal = { id: string; kind: string; severity: string; title: string; body: string; createdAt: string };

function localDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const SEV: Record<string, string> = {
  critical: "text-red-400 border-red-400/50",
  attention: "text-amber-400 border-amber-400/50",
  notice: "text-aurelius-gold border-aurelius-gold/50",
  info: "text-neutral-400 border-aurelius-gold/25",
};

export default function BridgePage() {
  const [signals, setSignals] = useState<Signal[] | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/deck");
    if (res.ok) setSignals((await res.json()).bridge);
  }, []);

  useEffect(() => { load(); }, [load]);

  const act = async (id: string, status: string) => {
    await fetch("/api/today/actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "ackSignal", id, status, date: localDate() }),
    });
    await load();
  };

  return (
    <main className="text-aurelius-text max-w-3xl mx-auto space-y-6">
      <header className="flex items-baseline justify-between border-b border-aurelius-gold/35 pb-3">
        <h1 className="aurelius-heading text-4xl">The Bridge</h1>
        <span className="text-sm text-neutral-500">{signals?.length ?? "…"} pending</span>
      </header>

      {signals && signals.length === 0 && (
        <p className="text-neutral-600 italic text-center py-16">
          Quiet. When Aurelius finishes something in the background — a research pass,
          a closed-out day, a pattern worth confirming — it lands here.
        </p>
      )}

      <ul className="space-y-4">
        {(signals ?? []).map((s) => (
          <li key={s.id} className={`aurelius-panel-frame p-5 border ${SEV[s.severity] ?? SEV.info}`}>
            <div className="flex items-start justify-between gap-3">
              <span className="font-medium">{s.title}</span>
              <span className="text-[10px] uppercase tracking-wider opacity-70 shrink-0 border border-current rounded px-1.5 py-0.5">
                {s.kind.replace(/_/g, " ")}
              </span>
            </div>
            {s.body && <p className="text-sm text-neutral-400 mt-2 whitespace-pre-line">{s.body}</p>}
            <div className="flex gap-2 mt-4">
              <button onClick={() => act(s.id, "acknowledged")}
                className="text-sm border border-aurelius-gold/40 rounded-lg px-3 py-1 hover:bg-aurelius-gold/20 text-aurelius-gold">Got it</button>
              <button onClick={() => act(s.id, "acted")}
                className="text-sm border border-emerald-500/40 rounded-lg px-3 py-1 hover:bg-emerald-500/15 text-emerald-400">Acted on it</button>
              <button onClick={() => act(s.id, "dismissed")}
                className="text-sm border border-neutral-600 rounded-lg px-3 py-1 hover:bg-neutral-800 text-neutral-400">Dismiss</button>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
