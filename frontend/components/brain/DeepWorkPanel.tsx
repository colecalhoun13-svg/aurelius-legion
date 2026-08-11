"use client";

// DEEP WORK — the worker, not the assistant. Cole hands Aurelius a research
// brief; Aurelius decomposes it into angles, runs the multi-source engine on
// each (web + academic), and hands back ONE full structured markdown report.
// This is the headline turn: "an assistant that answers" → "a worker that
// produces a document."
//
// The heavy work runs in the backend (POST /api/aurelius/deep-report), proxied
// through /api/research/deep. A single call is 20–60+ seconds of real research,
// so the UI commits to a genuine long-running busy state (no client abort
// before ~120s) rather than pretending it's instant. We cannot stream angles
// from this endpoint, so the busy state is a tasteful indeterminate one.
//
// The report renders through a hand-rolled markdown renderer (Md, below) built
// in the same spirit as WikiPanel's — React nodes only, NO dangerouslySetInnerHTML,
// no markdown dependency.

import React, { useRef, useState } from "react";
import { Btn, Panel } from "../kit";

// The research lenses — these are the real backend operators (core/operatorCores.ts:
// strategy · training · business · wealth …). "strategy" is the default the
// backend falls back to. (The task's example list named "health", but no such
// operator exists; the real operator set is used instead — see report notes.)
const LENSES = [
  { key: "strategy", label: "Strategy" },
  { key: "training", label: "Training" },
  { key: "business", label: "Business" },
  { key: "wealth", label: "Wealth" },
] as const;
type LensKey = (typeof LENSES)[number]["key"];

const DEPTHS = [
  { key: "shallow", label: "Shallow" },
  { key: "medium", label: "Medium" },
  { key: "deep", label: "Deep" },
] as const;
type DepthKey = (typeof DEPTHS)[number]["key"];

type Source = { title: string; url?: string };
type DeepReport = {
  ok: boolean;
  error?: string;
  title?: string;
  markdown?: string;
  sources?: Source[];
  grounding?: "external" | "model-only";
  angles?: string[];
  docId?: string;
};

/* ── inline markdown: **bold**, *italic*, `code`, [text](url) — React nodes,
      never innerHTML. Links open in a new tab, safely. ── */
function inline(text: string, keyBase: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*\n]+\*|`[^`]+`|\[[^\]]+\]\([^)\s]+\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("**")) {
      out.push(<strong key={`${keyBase}-${i}`} style={{ color: "var(--ink)" }}>{tok.slice(2, -2)}</strong>);
    } else if (tok.startsWith("`")) {
      out.push(
        <code key={`${keyBase}-${i}`} style={{
          fontFamily: "var(--font-data),ui-monospace,monospace", fontSize: ".92em",
          background: "var(--gold-ghost)", padding: "0 .3em", borderRadius: 2, color: "var(--ink2)",
        }}>{tok.slice(1, -1)}</code>
      );
    } else if (tok.startsWith("[")) {
      const mm = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(tok);
      if (mm) {
        out.push(
          <a key={`${keyBase}-${i}`} href={mm[2]} target="_blank" rel="noopener noreferrer"
            style={{ color: "var(--gold)", textDecoration: "underline", textUnderlineOffset: 2, wordBreak: "break-word" }}>
            {mm[1]}
          </a>
        );
      } else out.push(tok);
    } else {
      out.push(<em key={`${keyBase}-${i}`}>{tok.slice(1, -1)}</em>);
    }
    last = m.index + tok.length;
    i++;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

// Full-document renderer: headings, ordered + unordered lists, blockquotes,
// horizontal rules, paragraphs. Line-by-line, same approach as WikiPanel's Md.
function Md({ text }: { text: string }) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const blocks: React.ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;

  const flush = () => {
    if (!list) return;
    const items = list.items;
    if (list.ordered) {
      blocks.push(
        <ol key={`ol-${blocks.length}`} style={{ listStyle: "decimal", paddingLeft: "1.6rem", margin: ".5rem 0", display: "grid", gap: ".35rem" }}>
          {items.map((it, i) => <li key={i} style={{ color: "var(--ink2)", lineHeight: 1.7 }}>{inline(it, `oli-${blocks.length}-${i}`)}</li>)}
        </ol>
      );
    } else {
      blocks.push(
        <ul key={`ul-${blocks.length}`} style={{ listStyle: "disc", paddingLeft: "1.6rem", margin: ".5rem 0", display: "grid", gap: ".35rem" }}>
          {items.map((it, i) => <li key={i} style={{ color: "var(--ink2)", lineHeight: 1.7 }}>{inline(it, `uli-${blocks.length}-${i}`)}</li>)}
        </ul>
      );
    }
    list = null;
  };

  lines.forEach((raw, idx) => {
    const line = raw.replace(/\s+$/, "");
    const key = `md-${idx}`;

    const ol = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    const ul = /^\s*[-*+]\s+(.*)$/.exec(line);
    if (ol) {
      if (!list || !list.ordered) { flush(); list = { ordered: true, items: [] }; }
      list.items.push(ol[1]);
      return;
    }
    if (ul) {
      if (!list || list.ordered) { flush(); list = { ordered: false, items: [] }; }
      list.items.push(ul[1]);
      return;
    }
    flush();

    if (!line.trim()) { blocks.push(<div key={key} style={{ height: ".55rem" }} />); return; }
    if (/^#{1,6}\s/.test(line)) {
      const level = line.match(/^#+/)![0].length;
      const content = line.replace(/^#+\s+/, "");
      const sizes = ["1.6rem", "1.32rem", "1.12rem", "1rem", ".95rem", ".9rem"];
      const tag = `h${Math.min(level + 1, 6)}`;
      blocks.push(
        React.createElement(
          tag,
          {
            key,
            style: {
              fontFamily: "var(--font-serif),Georgia,serif", fontWeight: 700,
              fontSize: sizes[level - 1], color: "var(--ink)", letterSpacing: ".01em",
              margin: level <= 2 ? "1.5rem 0 .5rem" : "1.1rem 0 .35rem", lineHeight: 1.25,
            },
          },
          inline(content, key)
        )
      );
      return;
    }
    if (/^(---+|\*\*\*+|___+)$/.test(line.trim())) {
      blocks.push(<hr key={key} style={{ border: 0, borderTop: "1px solid var(--line1)", margin: "1.2rem 0" }} />);
      return;
    }
    if (/^>\s?/.test(line)) {
      blocks.push(
        <blockquote key={key} style={{
          borderLeft: "2px solid var(--gold-line)", paddingLeft: ".9rem", margin: ".5rem 0",
          color: "var(--ink3)", fontStyle: "italic", fontFamily: "var(--font-body),Georgia,serif",
        }}>{inline(line.replace(/^>\s?/, ""), key)}</blockquote>
      );
      return;
    }
    blocks.push(
      <p key={key} style={{
        fontFamily: "var(--font-body),Georgia,serif", fontSize: "1.08rem", lineHeight: 1.8,
        color: "var(--ink2)", margin: ".35rem 0",
      }}>{inline(line, key)}</p>
    );
  });
  flush();
  return <div>{blocks}</div>;
}

/* ── selector chip (lens / depth) ── */
function Chip({ on, onClick, disabled, children }: { on: boolean; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="text-xs px-3 py-1.5"
      style={{
        fontFamily: "var(--font-body),Georgia,serif", fontWeight: 600, fontSize: 12,
        letterSpacing: ".14em", textTransform: "uppercase", borderRadius: 2,
        cursor: disabled ? "default" : "pointer",
        border: `1px solid ${on ? "var(--gold-line)" : "var(--line1)"}`,
        color: on ? "var(--gold)" : "var(--ink3)",
        background: on ? "rgba(212,175,55,.08)" : "none",
        opacity: disabled ? 0.5 : 1,
        transition: "color .15s, border-color .15s",
      }}
    >
      {children}
    </button>
  );
}

/* ── grounding chip: money-green web-grounded / attn-amber model-only ── */
function GroundingChip({ grounding }: { grounding: "external" | "model-only" }) {
  const web = grounding === "external";
  const color = web ? "var(--money)" : "var(--attn)";
  return (
    <span
      title={web
        ? "Backed by real web + academic sources found during research."
        : "No external sources were reachable — this report is the model's own knowledge, NOT web-backed."}
      style={{
        display: "inline-flex", alignItems: "center", gap: ".45rem",
        fontFamily: "var(--font-data),Arial,sans-serif", fontSize: 11, fontWeight: 600,
        letterSpacing: ".14em", textTransform: "uppercase", color, whiteSpace: "nowrap",
        border: `1px solid ${color}`, borderRadius: 2, padding: ".2rem .55rem",
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: 999, background: color }} />
      {web ? "web-grounded" : "model-only"}
    </span>
  );
}

type HistItem = { id: number; brief: string; report: DeepReport };

export default function DeepWorkPanel() {
  const [brief, setBrief] = useState("");
  const [lens, setLens] = useState<LensKey>("strategy");
  const [depth, setDepth] = useState<DepthKey>("medium");
  const [running, setRunning] = useState(false);
  const [report, setReport] = useState<DeepReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState<HistItem[]>([]);
  const idRef = useRef(0);

  const run = async () => {
    const text = brief.trim();
    if (!text) { setError("Give me a real brief — a sentence or two on what to research."); setReport(null); return; }
    if (running) return;
    setRunning(true);
    setError(null);
    setReport(null);
    setCopied(false);
    try {
      const res = await fetch("/api/research/deep", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief: text, operator: lens, depth, maxAngles: depth === "deep" ? 6 : depth === "shallow" ? 3 : 4 }),
      });
      const data: DeepReport = await res.json().catch(() => ({ ok: false, error: `Unexpected response (${res.status}).` }));
      if (!data.ok) {
        // Honest failure — surface the backend's words verbatim (this is how
        // "no engine / fund a key" reaches Cole). Don't swallow it.
        setError(data.error || `Research failed (${res.status}).`);
        return;
      }
      setReport(data);
      const item: HistItem = { id: ++idRef.current, brief: text, report: data };
      setHistory((h) => [item, ...h].slice(0, 6));
    } catch (err: any) {
      setError(err?.message ?? String(err));
    } finally {
      setRunning(false);
    }
  };

  const copyMd = async () => {
    if (!report?.markdown) return;
    try {
      await navigator.clipboard.writeText(report.markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* clipboard blocked — no-op, the Download button still works */ }
  };

  const downloadMd = () => {
    if (!report?.markdown) return;
    const name = (report.title || "research-report")
      .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "research-report";
    const blob = new Blob([report.markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name}.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="max-w-3xl mx-auto space-y-6 relative" style={{ color: "var(--ink)" }}>
      {/* THE BRIEF — the commission */}
      <section className="space-y-4">
        <div className="au-chatbar" style={{ padding: ".7rem .75rem .7rem 1.3rem", alignItems: "flex-start" }}>
          <textarea
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            rows={3}
            disabled={running}
            placeholder="Hand Aurelius a research brief — e.g. “Compare velocity-based training vs percentage-based for high-school athletes and what the evidence says.”"
            aria-label="Research brief"
            style={{ fontSize: "1.15rem", resize: "vertical", minHeight: "4.5rem" }}
          />
        </div>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="au-kicker" style={{ fontSize: 12.5, fontStyle: "normal", letterSpacing: ".18em", textTransform: "uppercase", color: "var(--ink3)" }}>Lens</span>
            {LENSES.map((l) => (
              <Chip key={l.key} on={lens === l.key} disabled={running} onClick={() => setLens(l.key)}>{l.label}</Chip>
            ))}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="au-kicker" style={{ fontSize: 12.5, fontStyle: "normal", letterSpacing: ".18em", textTransform: "uppercase", color: "var(--ink3)" }}>Depth</span>
            {DEPTHS.map((d) => (
              <Chip key={d.key} on={depth === d.key} disabled={running} onClick={() => setDepth(d.key)}>{d.label}</Chip>
            ))}
          </div>
          <Btn onClick={run} disabled={running} className="ml-auto" aria-label="Research it">
            {running ? "Researching…" : "Research it"}
          </Btn>
        </div>

        {/* BUSY — a genuine long-running state; no angles can stream, so this
            is a tasteful indeterminate wait. */}
        {running && (
          <div className={`au-card p-6 aurelius-working`} aria-live="polite" aria-busy="true">
            <p className="au-kicker" style={{ display: "block", fontSize: "1.15rem", color: "var(--ink2)" }}>
              researching… (this takes a minute — multiple angles, real sources)
            </p>
            <p className="au-kicker" style={{ display: "block", marginTop: ".5rem", fontSize: 13, color: "var(--ink3)" }}>
              Decomposing the brief into angles, running the multi-source engine on each, then synthesizing one report. Leave this open.
            </p>
          </div>
        )}

        {/* HONEST FAILURE — the backend's words, in danger styling */}
        {error && !running && (
          <div className="au-card p-4" style={{ borderColor: "var(--danger)" }}>
            <p className="au-kicker" style={{ display: "block", fontSize: 11.5, letterSpacing: ".2em", textTransform: "uppercase", fontStyle: "normal", color: "var(--danger)" }}>Couldn’t deliver</p>
            <p style={{ marginTop: ".4rem", color: "var(--danger)", fontFamily: "var(--font-body),Georgia,serif", fontSize: "1.02rem", lineHeight: 1.6 }}>{error}</p>
          </div>
        )}
      </section>

      {/* THE REPORT — reads like a document */}
      {report?.ok && !running && (
        <article className="au-card p-6 md:p-8 aurelius-resolve" style={{ overflowWrap: "anywhere" }}>
          <header className="pb-4 mb-4" style={{ borderBottom: "1px solid var(--gold-line)" }}>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <h1 style={{
                fontFamily: "var(--font-serif),Georgia,serif", fontWeight: 700,
                fontSize: "clamp(1.5rem,3.5vw,2.1rem)", lineHeight: 1.15, color: "var(--ink)", margin: 0, flex: 1, minWidth: 0,
              }}>{report.title || "Research report"}</h1>
              {report.grounding && <GroundingChip grounding={report.grounding} />}
            </div>
            {report.angles && report.angles.length > 0 && (
              <p className="au-kicker" style={{ display: "block", marginTop: ".6rem", fontSize: 13, color: "var(--ink3)" }}>
                Angles pursued: {report.angles.join(" · ")}
              </p>
            )}
            <div className="flex gap-2 mt-4 flex-wrap">
              <Btn ghost onClick={copyMd} aria-label="Copy report markdown">{copied ? "Copied ✓" : "Copy"}</Btn>
              <Btn ghost onClick={downloadMd} aria-label="Download report as markdown">Download .md</Btn>
            </div>
          </header>

          <div style={{ maxWidth: "68ch" }}>
            {report.markdown ? <Md text={report.markdown} /> : <p className="au-kicker">The report came back empty.</p>}
          </div>

          {report.sources && report.sources.length > 0 && (
            <section className="mt-8 pt-4" style={{ borderTop: "1px solid var(--line1)" }}>
              <p className="au-kicker" style={{ display: "block", fontSize: 11.5, letterSpacing: ".26em", textTransform: "uppercase", fontStyle: "normal", color: "var(--ink3)", marginBottom: ".6rem" }}>
                Sources ({report.sources.length})
              </p>
              <ol style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: ".5rem" }}>
                {report.sources.map((s, i) => (
                  <li key={i} className="flex items-baseline gap-3" style={{ minWidth: 0 }}>
                    <span style={{ color: "var(--gold)", fontFamily: "var(--font-serif),Georgia,serif", fontSize: ".9rem", flexShrink: 0 }}>{i + 1}</span>
                    <span style={{ minWidth: 0, flex: 1 }}>
                      <span style={{ display: "block", color: "var(--ink2)", fontFamily: "var(--font-body),Georgia,serif", fontSize: ".98rem", lineHeight: 1.5 }}>{s.title}</span>
                      {s.url && (
                        <a href={s.url} target="_blank" rel="noopener noreferrer"
                          style={{ display: "block", color: "var(--gold-dim)", fontSize: 12, fontFamily: "var(--font-data),Arial,sans-serif", wordBreak: "break-all", overflowWrap: "anywhere", textDecoration: "underline", textUnderlineOffset: 2 }}>
                          {s.url}
                        </a>
                      )}
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {report.grounding === "model-only" && (
            <p className="au-kicker" style={{ display: "block", marginTop: "1.25rem", fontSize: 12.5, color: "var(--attn)" }}>
              Note: no external sources were reachable for this run — this report reflects the model’s own knowledge, not live web research.
            </p>
          )}
        </article>
      )}

      {/* IN-SESSION HISTORY — flip back to the last few without re-running */}
      {history.length > 1 && (
        <section className="space-y-2">
          <p className="au-kicker" style={{ display: "block", fontSize: 11.5, letterSpacing: ".26em", textTransform: "uppercase", fontStyle: "normal", color: "var(--ink3)" }}>
            This session
          </p>
          <div className="grid gap-2">
            {history.map((h) => {
              const active = report === h.report;
              return (
                <button
                  key={h.id}
                  onClick={() => { setReport(h.report); setError(null); setBrief(h.brief); }}
                  disabled={running}
                  className="w-full text-left px-4 py-2.5"
                  style={{
                    borderRadius: 2, cursor: running ? "default" : "pointer",
                    border: `1px solid ${active ? "var(--gold-line)" : "var(--line1)"}`,
                    background: active ? "rgba(212,175,55,.06)" : "none",
                  }}
                >
                  <span style={{ display: "block", color: active ? "var(--gold)" : "var(--ink2)", fontFamily: "var(--font-body),Georgia,serif", fontSize: ".98rem", lineHeight: 1.4 }}>
                    {h.report.title || h.brief.slice(0, 80)}
                  </span>
                  <span style={{ display: "block", color: "var(--ink3)", fontSize: 12, fontFamily: "var(--font-body),Georgia,serif", fontStyle: "italic", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {h.brief}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      <Panel tier="card" label="What this is">
        <p style={{ fontFamily: "var(--font-body),Georgia,serif", fontSize: "1.02rem", lineHeight: 1.7, color: "var(--ink2)" }}>
          Deep Work is the difference between an assistant that answers and a worker that produces a document.
          Aurelius breaks your brief into research angles, runs the multi-source engine (web + academic) on each,
          and synthesizes one structured report — saved to the corpus and handed back here to read, copy, or download.
          A single run is real research: give it a minute.
        </p>
      </Panel>
    </main>
  );
}
