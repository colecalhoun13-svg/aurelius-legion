"use client";

// SECOND BRAIN — ASK AS THE DOOR. Ask it anything; feed it notes, pages,
// research. Every ingestion is four writes deep: vector index, memory,
// awareness registry, bridge signal.
//
// ELEVATED IMPERIAL re-dress: the ask bar is the hero (au-chatbar, large
// Cormorant italic), answers arrive in the Aurelius voice (au-msg-aur),
// and the corpus numerals beneath derive ONLY from what this panel already
// fetches (/api/corpus) plus the existing /api/wiki listing — a stat with
// no data is omitted, never faked. Same handlers, same deep links.

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Btn, Divider, Panel, day } from "../kit";

type CorpusDoc = {
  id: string;
  title: string;
  sourceType: string;
  sourceUrl: string | null;
  domain: string;
  summary: string | null;
  chunkCount: number;
  createdAt: string;
};

type AskResult = {
  answer: string;
  sources: { sourceType: string; sourceId: string; title: string; similarity: number }[];
  engine: string;
  recallCount: number;
};

/* ── the corpus numeral (bstat): Cinzel figure over Cormorant caps ── */
function BStat({ n, label }: { n: React.ReactNode; label: string }) {
  return (
    <div className="text-center">
      <b style={{
        fontFamily: "var(--font-serif),Georgia,serif", fontWeight: 700, fontSize: "1.7rem",
        color: "var(--ink)", fontVariantNumeric: "tabular-nums", display: "block", lineHeight: 1.15,
      }}>{n}</b>
      <span style={{
        fontFamily: "var(--font-body),Georgia,serif", fontWeight: 600, fontSize: 11.5,
        letterSpacing: ".26em", textTransform: "uppercase", color: "var(--ink3)",
      }}>{label}</span>
    </div>
  );
}

export default function CorpusPage() {
  const [docs, setDocs] = useState<CorpusDoc[] | null>(null);
  // Syntheses count — the wiki listing this page's sibling tab already
  // reads; a cheap existing endpoint, shown only when it answers.
  const [wikiCount, setWikiCount] = useState<number | null>(null);

  // Ask
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [result, setResult] = useState<AskResult | null>(null);
  const [askError, setAskError] = useState<string | null>(null);
  const askRef = useRef<HTMLTextAreaElement>(null);

  // Ingest
  const [mode, setMode] = useState<"note" | "url">("note");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [url, setUrl] = useState("");
  const [domain, setDomain] = useState("");
  const [ingesting, setIngesting] = useState(false);
  const [ingestMsg, setIngestMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/corpus");
    if (res.ok) setDocs((await res.json()).documents);
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetch("/api/wiki")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (Array.isArray(j?.pages)) setWikiCount(j.pages.length); })
      .catch(() => {}); // no count → the numeral simply doesn't render
  }, []);

  // Arriving from the ⌘K bar: ?ask=… — keyed on the params so a SECOND ask
  // while already on this tab fires too (App Router same-route navigation
  // doesn't remount; the old mount-only effect silently dropped it).
  const searchParams = useSearchParams();
  const lastAskRef = useRef<string | null>(null);
  useEffect(() => {
    const q = searchParams.get("ask");
    if (q && q !== lastAskRef.current) {
      lastAskRef.current = q;
      setQuestion(q);
      submitAsk(q);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const submitAsk = async (q?: string) => {
    const text = (q ?? question).trim();
    if (!text || asking) return;
    setAsking(true);
    setAskError(null);
    setResult(null);
    try {
      const res = await fetch("/api/corpus/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "ask failed");
      setResult(data);
    } catch (err: any) {
      setAskError(err?.message ?? String(err));
    } finally {
      setAsking(false);
    }
  };

  const submitIngest = async () => {
    if (ingesting) return;
    const body =
      mode === "url"
        ? { url: url.trim(), domain: domain.trim() || undefined }
        : { title: title.trim(), content: content.trim(), domain: domain.trim() || undefined };
    if (mode === "url" ? !url.trim() : !title.trim() || !content.trim()) return;
    setIngesting(true);
    setIngestMsg(null);
    try {
      const res = await fetch("/api/corpus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "ingestion failed");
      setIngestMsg(`Absorbed "${data.doc.title}" — ${data.chunkCount} chunks indexed.`);
      setTitle(""); setContent(""); setUrl("");
      await load();
    } catch (err: any) {
      setIngestMsg(`Failed: ${err?.message ?? String(err)}`);
    } finally {
      setIngesting(false);
    }
  };

  // (The Library listing that used to live here duplicated Shelves/Catalog
  // one tab over — de-duplicated on the alignment council's ruling. This
  // panel is the ASK and the FEED; browsing lives on the Shelves.)

  const chunks = (docs ?? []).reduce((n, d) => n + d.chunkCount, 0);
  const lastLearned = (docs ?? []).reduce<string | null>(
    (m, d) => (d.createdAt && (!m || d.createdAt > m) ? d.createdAt : m), null
  );

  return (
    <main className="max-w-3xl mx-auto space-y-6 relative" style={{ color: "var(--ink)" }}>
      {/* ASK — the door */}
      <section className={`space-y-4 ${asking ? "aurelius-working" : ""}`} style={{ maxWidth: 700, margin: "0 auto" }}>
        <div className="au-chatbar" style={{ padding: ".5rem .55rem .5rem 1.3rem" }}>
          <textarea
            ref={askRef}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submitAsk();
              }
            }}
            rows={1}
            placeholder="Ask the second brain — it answers only from what it has absorbed…"
            aria-label="Ask"
            style={{ fontSize: "1.25rem", resize: "none" }}
          />
          <Btn onClick={() => submitAsk()} disabled={asking}>
            {asking ? "Recalling…" : "Ask"}
          </Btn>
        </div>

        {/* the corpus, in numerals — only what the fetches actually returned */}
        {docs !== null && (
          <div className="flex gap-10 justify-center flex-wrap pt-1">
            <BStat n={docs.length} label="documents" />
            <BStat n={chunks} label="passages in recall" />
            {wikiCount != null && <BStat n={wikiCount} label="syntheses" />}
            {lastLearned && <BStat n={day(lastLearned)} label="last learned" />}
          </div>
        )}

        {askError && <p className="text-sm" style={{ color: "var(--danger)" }}>{askError}</p>}

        {result && (
          <div className="space-y-3 aurelius-resolve pt-2">
            <p className="au-msg-aur whitespace-pre-wrap" style={{ maxWidth: "none" }}>{result.answer}</p>
            {result.sources.length > 0 && (
              <div className="text-xs space-y-1.5" style={{ color: "var(--ink3)" }}>
                <span style={{
                  fontFamily: "var(--font-body),Georgia,serif", fontWeight: 600, fontSize: 11.5,
                  letterSpacing: ".26em", textTransform: "uppercase",
                }}>Drawn from</span>
                {result.sources.map((s, i) => (
                  <div key={i} className="flex items-center gap-2.5">
                    <span className="w-4" style={{ color: "var(--gold)", fontFamily: "var(--font-serif),Georgia,serif" }}>{i + 1}</span>
                    <span className="flex-1 truncate">{s.title}</span>
                    <span style={{ color: "var(--ink3)", opacity: 0.7 }}>{s.sourceType}</span>
                    <span className="aurelius-meter" title={`${(s.similarity * 100).toFixed(0)}% match`}>
                      <span style={{ width: `${Math.max(6, Math.round(s.similarity * 100))}%` }} />
                    </span>
                  </div>
                ))}
              </div>
            )}
            <p className="au-kicker" style={{ display: "block", fontSize: 12 }}>
              {result.recallCount} passages recalled · {result.engine}
            </p>
          </div>
        )}
      </section>

      <Divider />

      {/* FEED IT */}
      <Panel tier="card" label="Feed the brain">
        <div className="space-y-3">
          <div className="flex gap-2">
            {(["note", "url"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className="text-xs px-3 py-1"
                style={{
                  fontFamily: "var(--font-body),Georgia,serif", fontWeight: 600,
                  letterSpacing: ".14em", textTransform: "uppercase", borderRadius: 2, cursor: "pointer",
                  border: `1px solid ${mode === m ? "var(--gold-line)" : "var(--line1)"}`,
                  color: mode === m ? "var(--gold)" : "var(--ink3)",
                  background: mode === m ? "rgba(212,175,55,.08)" : "none",
                }}
              >
                {m === "note" ? "✎ note / paste" : "⛓ url"}
              </button>
            ))}
          </div>

          {mode === "note" ? (
            <>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Title…"
                className="w-full bg-black/40 border border-aurelius-gold/25 rounded-[2px] px-3 py-2 text-sm outline-none focus:border-aurelius-gold/60"
              />
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={7}
                placeholder="Paste the material — article, notes, transcript, research…"
                className="w-full bg-black/40 border border-aurelius-gold/25 rounded-[2px] px-3 py-2 text-sm resize-y outline-none focus:border-aurelius-gold/60"
              />
            </>
          ) : (
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://…"
              className="w-full bg-black/40 border border-aurelius-gold/25 rounded-[2px] px-3 py-2 text-sm outline-none focus:border-aurelius-gold/60"
            />
          )}

          <input
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="Domain (training, business, personal…) — optional"
            className="w-full bg-black/40 border border-aurelius-gold/25 rounded-[2px] px-3 py-2 text-sm outline-none focus:border-aurelius-gold/60"
          />

          <Btn onClick={submitIngest} disabled={ingesting} className="w-full">
            {ingesting ? "Absorbing…" : "Ingest"}
          </Btn>

          {ingestMsg && (
            <p className="text-xs" style={{ color: ingestMsg.startsWith("Failed") ? "var(--danger)" : "var(--gold)" }}>
              {ingestMsg}
            </p>
          )}

          <p className="text-[11px] leading-relaxed pt-2" style={{ color: "var(--ink3)", borderTop: "1px solid var(--line1)" }}>
            Every ingestion: indexed for recall, remembered, registered in
            Aurelius&apos;s awareness, and surfaced on the Bridge. Browse the
            collection on the Shelves tab.
          </p>
        </div>
      </Panel>
    </main>
  );
}
