"use client";

// TOOLS — Aurelius's hands. What's wired, what's next, per the
// integration roadmap. Live adapters come from the Tool Engine registry;
// planned ones show their phase so the map travels with the app.

import { useEffect, useState } from "react";

type ToolInfo = { name: string; actions: string[] };

const ROADMAP = [
  { name: "Google Sheets", status: "live", desc: "Reads athlete sessions, writes feedback + PRs back", glyph: "▦" },
  { name: "Google Calendar", status: "next", desc: "Read/write events, propose schedules — the calendar engine", glyph: "▤" },
  { name: "Telegram", status: "next", desc: "Aurelius in your pocket — briefings, capture, two-way chat", glyph: "✈" },
  { name: "Research APIs", status: "partial", desc: "arXiv · PubMed · Semantic Scholar — weekend ingestion feeds", glyph: "❉" },
  { name: "Gmail", status: "planned", desc: "Read + draft-only. Flags what needs you, never sends alone", glyph: "✉" },
  { name: "Whisper (local)", status: "planned", desc: "Voice notes → capture. Talk to the second brain", glyph: "◉" },
  { name: "Instagram Graph", status: "planned", desc: "Content operator's eyes — analytics, trends, drafts", glyph: "▣" },
  { name: "Canvas LMS", status: "planned", desc: "School assignments + due dates into Today", glyph: "✎" },
  { name: "Cal.com (self-hosted)", status: "planned", desc: "Owned booking — athletes book, pipeline visible", glyph: "◷" },
  { name: "Plaid / SimpleFIN", status: "later", desc: "Wealth operator's ledger — read-only, local-first era", glyph: "◈" },
  { name: "Ollama (Mac Mini)", status: "later", desc: "Free local inference — embeddings + bulk background work", glyph: "⌂" },
];

const STATUS_STYLE: Record<string, string> = {
  live: "text-emerald-400 border-emerald-400/50",
  partial: "text-aurelius-gold border-aurelius-gold/50",
  next: "text-amber-300 border-amber-300/50",
  planned: "text-neutral-400 border-neutral-600",
  later: "text-neutral-600 border-neutral-700",
};

export default function ToolsPage() {
  const [live, setLive] = useState<ToolInfo[] | null>(null);

  useEffect(() => {
    fetch("/api/tools").then(async (r) => { if (r.ok) setLive(await r.json()); }).catch(() => {});
  }, []);

  return (
    <main className="text-aurelius-text max-w-4xl mx-auto space-y-6 aurelius-stagger">
      <header className="aurelius-rule">
        <h1 className="aurelius-heading text-4xl">Tools</h1>
        <p className="text-sm text-neutral-500 mt-1">
          Aurelius's hands. Read broadly, write narrowly — anything outward goes through propose → confirm.
        </p>
      </header>

      {live && live.length > 0 && (
        <section className="aurelius-panel-frame p-5">
          <h2 className="aurelius-heading text-lg mb-3">Registered in the Tool Engine</h2>
          <ul className="space-y-2 text-sm">
            {live.map((t) => (
              <li key={t.name}>
                <span className="text-emerald-400">●</span> <span className="text-neutral-200">{t.name}</span>
                <span className="text-neutral-500 text-xs ml-2">{t.actions.join(" · ")}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {ROADMAP.map((t) => (
          <div key={t.name} className="aurelius-panel-frame p-4 flex items-start gap-3">
            <span className="text-aurelius-gold text-xl mt-0.5">{t.glyph}</span>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="font-medium">{t.name}</span>
                <span className={`text-[10px] uppercase tracking-wider border rounded px-1.5 py-0.5 ${STATUS_STYLE[t.status]}`}>{t.status}</span>
              </div>
              <p className="text-xs text-neutral-500 mt-1">{t.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
