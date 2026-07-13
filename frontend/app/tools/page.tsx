"use client";

// TOOLS — Aurelius's hands. Status is LIVE-DERIVED from the backend
// (registry + config + connection checks), never hardcoded — so this
// page can't drift out of sync with reality the way a static roadmap
// does. If a card is wrong, the truth-source is aurelius/tools/
// integrationStatus.ts, not this file.

import { useEffect, useState } from "react";

type ToolInfo = { name: string; actions: string[] };
type Integration = {
  name: string;
  status: "live" | "partial" | "config" | "deploy" | "planned" | "parked";
  desc: string;
  glyph: string;
  need?: string;
};

const STATUS_STYLE: Record<string, string> = {
  live: "text-emerald-400 border-emerald-400/50",
  partial: "text-aurelius-gold border-aurelius-gold/50",
  config: "text-amber-300 border-amber-300/50",
  deploy: "text-sky-300 border-sky-400/40",
  planned: "text-neutral-400 border-neutral-600",
  parked: "text-neutral-500 border-neutral-700",
};
const STATUS_LABEL: Record<string, string> = {
  live: "live",
  partial: "partial",
  config: "needs a key",
  deploy: "at deploy",
  planned: "not built yet",
  parked: "parked",
};
const ORDER = ["live", "partial", "config", "deploy", "planned", "parked"];

export default function ToolsPage() {
  const [registered, setRegistered] = useState<ToolInfo[] | null>(null);
  const [integrations, setIntegrations] = useState<Integration[]>([]);

  useEffect(() => {
    fetch("/api/tools")
      .then(async (r) => {
        if (!r.ok) return;
        const d = await r.json();
        setRegistered(d.registered ?? []);
        setIntegrations(d.integrations ?? []);
      })
      .catch(() => {});
  }, []);

  const sorted = [...integrations].sort((a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status));
  const liveCount = integrations.filter((i) => i.status === "live" || i.status === "partial").length;

  return (
    <main className="text-aurelius-text max-w-4xl mx-auto space-y-6 aurelius-stagger">
      <header className="aurelius-rule">
        <h1 className="aurelius-heading text-4xl">Tools</h1>
        <p className="text-sm text-neutral-500 mt-1">
          Aurelius's hands. Read broadly, write narrowly — anything outward goes through propose → confirm.
          {integrations.length > 0 && (
            <span className="text-neutral-400"> · {liveCount} live, {integrations.length - liveCount} waiting on a key or the Mini.</span>
          )}
        </p>
      </header>

      {registered && registered.length > 0 && (
        <section className="aurelius-panel-frame p-5">
          <h2 className="aurelius-heading text-lg mb-3">Registered in the Tool Engine</h2>
          <ul className="space-y-2 text-sm">
            {registered.map((t) => (
              <li key={t.name}>
                <span className="text-emerald-400">●</span> <span className="text-neutral-200">{t.name}</span>
                <span className="text-neutral-500 text-xs ml-2">{t.actions.join(" · ")}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sorted.map((t) => (
          <div key={t.name} className="aurelius-panel-frame p-4 flex items-start gap-3">
            <span className="text-aurelius-gold text-xl mt-0.5">{t.glyph}</span>
            <div className="flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{t.name}</span>
                <span className={`text-[10px] uppercase tracking-wider border rounded px-1.5 py-0.5 shrink-0 ${STATUS_STYLE[t.status]}`}>
                  {STATUS_LABEL[t.status]}
                </span>
              </div>
              <p className="text-xs text-neutral-500 mt-1">{t.desc}</p>
              {t.need && <p className="text-[11px] text-neutral-600 mt-1.5 italic">→ {t.need}</p>}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
