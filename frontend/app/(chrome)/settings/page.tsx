"use client";

// SETTINGS — real, finally. One truth source: the backend's integration
// registry (status derived from live state, never hardcoded). Green means
// working now; anything else says exactly what unlocks it — hard rule 4
// ("dormant until configured") made visible, with one-click connects for
// the OAuth flows.

import { useEffect, useState } from "react";

type Integration = {
  name: string;
  status: "live" | "partial" | "config" | "deploy" | "planned" | "parked";
  desc: string;
  glyph: string;
  need?: string;
};

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:3001";

const LIGHT: Record<Integration["status"], { dot: string; label: string }> = {
  live: { dot: "bg-emerald-400", label: "live" },
  partial: { dot: "bg-amber-400", label: "partial" },
  config: { dot: "bg-aurelius-gold/70", label: "needs a key" },
  deploy: { dot: "bg-neutral-500", label: "wakes at the Mini" },
  planned: { dot: "bg-neutral-600", label: "not built yet" },
  parked: { dot: "bg-neutral-700", label: "parked" },
};

const CONNECTS: Array<{ name: string; href: string; desc: string }> = [
  { name: "Google (Calendar · Sheets · Drive)", href: `${BACKEND}/api/calendar/auth`, desc: "one authorization covers all three" },
  { name: "Gmail", href: `${BACKEND}/api/gmail/auth`, desc: "read + draft-only, never sends alone" },
  { name: "Instagram", href: `${BACKEND}/api/instagram/auth`, desc: "metrics + gated publishing" },
];

export default function SettingsPage() {
  const [items, setItems] = useState<Integration[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/tools")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("unreachable"))))
      .then((j) => setItems(j.integrations ?? []))
      .catch(() => setErr("Aurelius couldn't load integration status — try again in a moment."));
  }, []);

  const sorted = (items ?? []).slice().sort((a, b) => {
    const order = ["live", "partial", "config", "deploy", "planned", "parked"];
    return order.indexOf(a.status) - order.indexOf(b.status);
  });

  return (
    <main className="text-aurelius-text max-w-2xl mx-auto space-y-8 aurelius-stagger">
      <header className="aurelius-rule">
        <h1 className="aurelius-heading text-4xl">Settings</h1>
      </header>

      <section className="space-y-2">
        <h2 className="aurelius-heading text-sm text-aurelius-gold/70 tracking-widest">One-click connects</h2>
        <div className="space-y-2">
          {CONNECTS.map((c) => (
            <a
              key={c.name}
              href={c.href}
              className="flex items-center gap-4 aurelius-panel-frame border border-aurelius-gold/20 px-4 py-3 hover:border-aurelius-gold/50"
            >
              <span className="flex-1">
                <span className="block text-sm">{c.name}</span>
                <span className="block text-xs text-neutral-500">{c.desc}</span>
              </span>
              <span className="text-xs text-aurelius-gold border border-aurelius-gold/40 rounded-lg px-3 py-1.5">Connect</span>
            </a>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="aurelius-heading text-sm text-aurelius-gold/70 tracking-widest">Everything, honestly</h2>
        {err && <p className="text-sm text-amber-300/90">{err}</p>}
        {items === null && !err && <p className="text-sm text-neutral-500">…</p>}
        <div className="space-y-1.5">
          {sorted.map((it) => (
            <div key={it.name} className="flex items-start gap-3 px-1 py-1.5">
              <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${LIGHT[it.status]?.dot ?? "bg-neutral-600"}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-sm">{it.name}</span>
                  <span className="text-[10px] uppercase tracking-widest text-neutral-500">{LIGHT[it.status]?.label}</span>
                </div>
                {it.status !== "live" && it.need && <p className="text-xs text-neutral-500 mt-0.5">{it.need}</p>}
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
