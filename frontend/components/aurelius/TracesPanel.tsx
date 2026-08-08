"use client";

// TRACES — one turn, end to end. Each thread is a single operation (a chat
// request, a scheduled ritual, an action) reassembled from the LogEntry rows
// that share its traceId: request in → operator routed → model called → tools
// run → action gated or acted. "Debug from the cockpit alone" (NORTH_STAR DoD).
//
// ELEVATED IMPERIAL re-dress: same /api/traces fetch, same spine-grid filter
// handshake, same expand/collapse — au-card threads, imperial inks.

import { useCallback, useEffect, useState } from "react";
import { SectionLabel } from "../kit";
import SpineHealth from "./SpineHealth";

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

// Imperial inks per kind — gold for the mind, patina for the hands.
const KIND_INK: Record<string, string> = {
  request: "var(--ink2)",
  llm: "var(--gold)",
  tool: "var(--money)",
  action: "var(--attn)",
  schedule: "var(--gold-dim)",
  catchup: "var(--gold-dim)",
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

export default function TracesPanel() {
  const [threads, setThreads] = useState<Thread[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  // Set by tapping a spine-health dot — the grid filters the list to that job.
  const [jobFilter, setJobFilter] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/traces");
      if (!res.ok) throw new Error("Aurelius couldn't load this right now — try again in a moment.");
      const j = await res.json();
      setThreads(j.threads ?? []);
    } catch (e: any) {
      setErr(e?.message ?? "failed to load");
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="max-w-3xl mx-auto space-y-5 aurelius-reveal">
      <div className="flex items-baseline justify-between gap-4 flex-wrap">
        <SectionLabel row>Traces — every act, one tap deep</SectionLabel>
        <button onClick={load} className="au-undo" style={{ marginLeft: 0 }}>refresh</button>
      </div>

      <p className="au-kicker" style={{ display: "block", fontSize: 13.5 }}>
        every step of one decision, threaded by a shared id — a turn from request to action
      </p>

      {/* The aggregate the thread list lacks: did every scheduled job fire?
          Tapping a dot filters the thread list to that job. */}
      <SpineHealth onPick={(j) => setJobFilter((cur) => (cur === j ? null : j))} />

      {jobFilter && (
        <p className="text-xs" style={{ color: "var(--ink2)" }}>
          Showing threads for <span style={{ color: "var(--gold)" }}>{jobFilter.replace(/_/g, " ")}</span>{" "}
          <button onClick={() => setJobFilter(null)} className="ml-1" style={{ color: "var(--ink3)", background: "none", border: 0, cursor: "pointer" }}>
            ✕ clear
          </button>
          {threads &&
            threads.filter((t) => t.label.toLowerCase().replace(/[^a-z0-9]/g, "").includes(jobFilter.toLowerCase().replace(/[^a-z0-9]/g, ""))).length === 0 && (
              <span className="au-kicker block mt-1" style={{ fontSize: 12.5 }}>
                No threads for this job in the recent window — weekly jobs often scroll out of the last 25.
              </span>
            )}
        </p>
      )}

      {err && <p className="text-sm" style={{ color: "var(--danger)" }}>Couldn't load traces: {err}</p>}
      {threads && threads.length === 0 && (
        <p className="au-kicker text-center py-16" style={{ display: "block" }}>
          No threads yet. As requests and scheduled rituals run, each one lands here as a
          single, replayable thread.
        </p>
      )}

      <ul className="space-y-3">
        {(threads ?? [])
          .filter((t) => !jobFilter || t.label.toLowerCase().replace(/[^a-z0-9]/g, "").includes(jobFilter.toLowerCase().replace(/[^a-z0-9]/g, "")))
          .map((t) => {
          const isOpen = open === t.traceId;
          return (
            <li key={t.traceId} className="au-card" style={t.hadError ? { borderColor: "rgba(201,107,90,.4)" } : undefined}>
              {/* Thread header — click to expand the timeline */}
              <button
                onClick={() => setOpen(isOpen ? null : t.traceId)}
                className="w-full text-left p-4 flex items-center gap-3"
                style={{ background: "none", border: 0, cursor: "pointer", color: "inherit" }}
              >
                <span className="text-lg shrink-0" style={{ color: t.hadError ? "var(--danger)" : "var(--gold-dim)" }}>
                  {isOpen ? "▾" : "▸"}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm truncate" style={{ color: "var(--ink)" }}>{t.label}</span>
                  <span className="block text-[11px] mt-0.5" style={{ color: "var(--ink3)", fontVariantNumeric: "tabular-nums" }}>
                    {relDay(t.startedAt)} · {fmtTime(t.startedAt)} · {t.count} steps · {fmtDur(t.durationMs)}
                  </span>
                </span>
                <span className="flex gap-1 shrink-0 flex-wrap justify-end">
                  {t.kinds.map((k) => (
                    <span
                      key={k}
                      className="text-[10px] uppercase tracking-wider border rounded-[2px] px-1.5 py-0.5"
                      style={{ color: KIND_INK[k] ?? "var(--ink3)", borderColor: "var(--line2)" }}
                    >
                      {KIND_GLYPH[k] ?? "•"} {k}
                    </span>
                  ))}
                </span>
                {t.hadError && (
                  <span
                    className="text-[10px] uppercase tracking-wider border rounded-[2px] px-1.5 py-0.5 shrink-0"
                    style={{ color: "var(--danger)", borderColor: "rgba(201,107,90,.5)" }}
                  >
                    error
                  </span>
                )}
              </button>

              {/* The timeline */}
              {isOpen && (
                <ol className="px-4 py-3 space-y-0" style={{ borderTop: "1px solid var(--line1)" }}>
                  {t.steps.map((s, i) => {
                    const errored = s.status === "error";
                    return (
                      <li key={s.id} className="flex gap-3 py-2 relative">
                        {/* rail */}
                        <span className="flex flex-col items-center shrink-0 w-5">
                          <span className="text-sm" style={{ color: errored ? "var(--danger)" : KIND_INK[s.kind ?? ""] ?? "var(--ink3)" }}>
                            {KIND_GLYPH[s.kind ?? ""] ?? "•"}
                          </span>
                          {i < t.steps.length - 1 && <span className="flex-1 w-px mt-1" style={{ background: "var(--line1)" }} />}
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="flex items-baseline justify-between gap-2">
                            <span className="text-sm truncate" style={{ color: errored ? "var(--danger)" : "var(--ink)" }}>{s.name}</span>
                            <span className="text-[10px] shrink-0" style={{ color: "var(--ink3)", fontVariantNumeric: "tabular-nums" }}>
                              {fmtTime(s.ts)}{s.durationMs != null ? ` · ${fmtDur(s.durationMs)}` : ""}
                            </span>
                          </span>
                          {errored && s.detail?.error && (
                            <span className="block text-xs mt-0.5 whitespace-pre-line" style={{ color: "var(--danger)" }}>{String(s.detail.error)}</span>
                          )}
                          {!errored && detailLine(s) && (
                            <span className="block text-[11px] mt-0.5" style={{ color: "var(--ink3)" }}>{detailLine(s)}</span>
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
    </div>
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
