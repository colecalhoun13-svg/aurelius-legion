"use client";

// ENGINES — the minds behind the mind. Which model answers which kind of
// call, what's configured, and the internal engines registered in the core.

import { useEffect, useState } from "react";

type Routing = { tier: string; provider: string; model: string; when: string; configured: boolean };
type EngineInfo = { name: string; description: string };
type Data = { engines: EngineInfo[]; routing: Routing[]; embeddings: { provider: string } };

export default function EnginesPage() {
  const [data, setData] = useState<Data | null>(null);

  useEffect(() => {
    fetch("/api/engines").then(async (r) => r.ok && setData(await r.json()));
  }, []);

  return (
    <main className="text-aurelius-text max-w-4xl mx-auto space-y-6 aurelius-stagger">
      <header className="flex items-baseline justify-between aurelius-rule">
        <h1 className="aurelius-heading text-4xl">Engines</h1>
        <span className="text-sm text-neutral-500">
          {data ? `${data.routing.filter((r) => r.configured).length}/${data.routing.length} minds armed` : "…"}
        </span>
      </header>

      <section className="aurelius-panel-frame p-5">
        <h2 className="aurelius-heading text-lg mb-1">Routing</h2>
        <p className="text-xs text-neutral-500 mb-4">
          One task, the right mind — the router picks per call. Unarmed tiers fall through to the default.
        </p>
        <div className="space-y-2.5">
          {(data?.routing ?? []).map((r) => (
            <div key={r.tier} className="flex items-center gap-3 border border-aurelius-gold/15 rounded-lg px-4 py-2.5 bg-black/30">
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  r.configured
                    ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)]"
                    : "bg-neutral-700"
                }`}
                title={r.configured ? "key configured" : "no key — dormant"}
              />
              <span className="aurelius-heading text-sm w-32 shrink-0">{r.tier}</span>
              <span className="text-sm text-neutral-300 w-64 shrink-0 truncate">
                {r.model}
                <span className="text-neutral-600"> · {r.provider}</span>
              </span>
              <span className="text-xs text-neutral-500 flex-1">{r.when}</span>
            </div>
          ))}
        </div>
        {data && (
          <p className="text-[11px] text-neutral-600 mt-3">
            Embeddings: {data.embeddings.provider} · recall runs on pgvector
          </p>
        )}
      </section>

      <section className="aurelius-panel-frame p-5">
        <h2 className="aurelius-heading text-lg mb-1">Core engines</h2>
        <p className="text-xs text-neutral-500 mb-4">
          Internal machinery registered at boot — these do work, not chat.
        </p>
        {(data?.engines ?? []).length === 0 ? (
          <p className="text-neutral-600 italic text-sm">Registry empty.</p>
        ) : (
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-sm">
            {data!.engines.map((e) => (
              <li key={e.name} className="border border-aurelius-gold/15 rounded-lg px-4 py-2.5 bg-black/30">
                <span className="text-aurelius-gold">{e.name}</span>
                {e.description && <p className="text-xs text-neutral-500 mt-1">{e.description}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
