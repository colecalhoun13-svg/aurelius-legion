"use client";

// TRACES — one turn, end to end. Each thread is a single operation (a chat
// request, a scheduled ritual, an action) reassembled from the LogEntry rows
// that share its traceId: request in → operator routed → model called → tools
// run → action gated or acted. "Debug from the cockpit alone" (NORTH_STAR DoD).

import { useCallback, useEffect, useState } from "react";

type Step = {
  id: string;
  ts: string;
  type: string;
  kind: string | null;
  name: string;
  status: "ok" | "error" | "started" | null;
  durationMs: number | null;
  detail: Record<string, any>;
};
type Thread = {
  traceId: string;
  label: string;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  count: number;
  hadError: boolean;
  kinds: string[];
  steps: Step[];
};

const KIND_GLYPH: Record<string, string> = {
  request: "⇥",
  llm: "❂",
  tool: "⚒",
  action: "▲",
  schedule: "◷",
  catchup: "↺",
};

const KIND_COLOR: Record<string, string> = {
  request: "text-sky-300 border-sky-400/40",
  llm: "text-aurelius-gold border-aurelius-gold/40",
  tool: "text-emerald-300 border-emerald-400/40",
  action: "text-amber-300 border-amber-400/40",
  schedule: "text-violet-300 border-violet-400/40",
  catchup: "text-violet-300 border-violet-400/40",
};

function fmtTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
function fmtDur(ms: number | null): string {
  if (ms == null) return "";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}
function relDay(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

export default function TracesPage() {
  const [threads, setThreads] = useState<Thread[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/traces");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j = await res.json();
      setThreads(j.threads ?? []);
    } catch (e: any) {
      setErr(e?.message ?? "failed to load");
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <main className="text-aurelius-text max-w-3xl mx-auto space-y-5 aurelius-stagger">
      <header className="flex items-baseline justify-between aurelius-rule">
        <h1 className="aurelius-heading text-4xl">Traces</h1>
        <button onClick={load} className="text-xs text-neutral-500 hover:text-aurelius-gold">refresh</button>
      </header>

      <p className="text-sm text-neutral-500">
        Every step of one decision, threaded by a shared id — a turn from request to action.
      </p>

      {err && <p className="text-red-400 text-sm">Couldn't load traces: {err}</p>}
      {threads && threads.length === 0 && (
        <p className="text-neutral-600 italic text-center py-16">
          No threads yet. As requests and scheduled rituals run, each one lands here as a
          single, replayable thread.
        </p>
      )}

      <ul className="space-y-3">
        {(threads ?? []).map((t) => {
          const isOpen = open === t.traceId;
          return (
            <li key={t.traceId} className={`aurelius-panel-frame border ${t.hadError ? "border-red-400/40" : "border-aurelius-gold/20"}`}>
              {/* Thread header — click to expand the timeline */}
              <button
                onClick={() => setOpen(isOpen ? null : t.traceId)}
                className="w-full text-left p-4 flex items-center gap-3"
              >
                <span className={`text-lg shrink-0 ${t.hadError ? "text-red-400" : "text-aurelius-gold/70"}`}>
                  {isOpen ? "▾" : "▸"}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block font-medium text-sm truncate">{t.label}</span>
                  <span className="block text-[11px] text-neutral-600 mt-0.5">
                    {relDay(t.startedAt)} · {fmtTime(t.startedAt)} · {t.count} steps · {fmtDur(t.durationMs)}
                  </span>
                </span>
                <span className="flex gap-1 shrink-0 flex-wrap justify-end">
                  {t.kinds.map((k) => (
                    <span key={k} className={`text-[10px] uppercase tracking-wider border rounded px-1.5 py-0.5 ${KIND_COLOR[k] ?? "text-neutral-400 border-neutral-600"}`}>
                      {KIND_GLYPH[k] ?? "•"} {k}
                    </span>
                  ))}
                </span>
                {t.hadError && (
                  <span className="text-[10px] uppercase tracking-wider text-red-400 border border-red-400/50 rounded px-1.5 py-0.5 shrink-0">error</span>
                )}
              </button>

              {/* The timeline */}
              {isOpen && (
                <ol className="border-t border-aurelius-gold/15 px-4 py-3 space-y-0">
                  {t.steps.map((s, i) => {
                    const color = KIND_COLOR[s.kind ?? ""] ?? "text-neutral-400 border-neutral-600";
                    const errored = s.status === "error";
                    return (
                      <li key={s.id} className="flex gap-3 py-2 relative">
                        {/* rail */}
                        <span className="flex flex-col items-center shrink-0 w-5">
                          <span className={`text-sm ${errored ? "text-red-400" : color.split(" ")[0]}`}>
                            {KIND_GLYPH[s.kind ?? ""] ?? "•"}
                          </span>
                          {i < t.steps.length - 1 && <span className="flex-1 w-px bg-aurelius-gold/15 mt-1" />}
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="flex items-baseline justify-between gap-2">
                            <span className={`text-sm truncate ${errored ? "text-red-300" : "text-neutral-200"}`}>{s.name}</span>
                            <span className="text-[10px] text-neutral-600 shrink-0">
                              {fmtTime(s.ts)}{s.durationMs != null ? ` · ${fmtDur(s.durationMs)}` : ""}
                            </span>
                          </span>
                          {errored && s.detail?.error && (
                            <span className="block text-xs text-red-400/80 mt-0.5 whitespace-pre-line">{String(s.detail.error)}</span>
                          )}
                          {!errored && detailLine(s) && (
                            <span className="block text-[11px] text-neutral-500 mt-0.5">{detailLine(s)}</span>
                          )}
                        </span>
                      </li>
                    );
                  })}
                </ol>
              )}
            </li>
          );
        })}
      </ul>
    </main>
  );
}

// A compact, human line of the step's most useful metadata — kept small so the
// timeline reads as a thread, not a data dump.
function detailLine(s: Step): string {
  const d = s.detail ?? {};
  const parts: string[] = [];
  if (s.kind === "llm") {
    if (d.taskType) parts.push(String(d.taskType));
    if (typeof d.tokensUsed === "number") parts.push(`${d.tokensUsed} tok`);
    if (d.failedOverFrom) parts.push(`failover from ${d.failedOverFrom}`);
  } else if (s.kind === "tool") {
    if (typeof d.retries === "number" && d.retries > 0) parts.push(`${d.retries} retr`);
  } else if (s.kind === "request") {
    if (d.method) parts.push(String(d.method));
    if (d.statusCode) parts.push(`→ ${d.statusCode}`);
  } else if (s.kind === "action") {
    if (d.finalized === true) parts.push("finalized");
    if (d.finalized === false) parts.push("gated");
  }
  return parts.join(" · ");
}
