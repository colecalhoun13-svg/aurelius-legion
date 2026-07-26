"use client";

// SECOND BRAIN — the library Aurelius is aware of.
// Ask it anything; feed it notes, pages, research. Every ingestion is
// four writes deep: vector index, memory, awareness registry, bridge signal.

import { useCallback, useEffect, useRef, useState } from "react";

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

const SOURCE_GLYPH: Record<string, string> = {
  note: "✎",
  url: "⛓",
  upload: "▲",
  research: "☄",
};

export default function CorpusPage() {
  const [docs, setDocs] = useState<CorpusDoc[] | null>(null);
  const [domainFilter, setDomainFilter] = useState<string>("");

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
    // Arriving from the top-bar search: /corpus?ask=…
    const q = new URLSearchParams(window.location.search).get("ask");
    if (q) {
      setQuestion(q);
      submitAsk(q);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const domains = Array.from(new Set((docs ?? []).map((d) => d.domain))).sort();
  const visible = (docs ?? []).filter((d) => !domainFilter || d.domain === domainFilter);

  return (
    <main className="text-aurelius-text max-w-5xl mx-auto space-y-6 aurelius-stagger">
      <header className="flex items-baseline justify-between aurelius-rule">
        <h1 className="aurelius-heading text-4xl">Second Brain</h1>
        <span className="text-sm text-neutral-500">
          {docs === null ? "…" : `${docs.length} documents · ${docs.reduce((n, d) => n + d.chunkCount, 0)} chunks in recall`}
        </span>
      </header>

      {/* ASK — the front door */}
      <section className={`aurelius-panel-frame p-5 space-y-3 ${asking ? "aurelius-working" : ""}`}>
        <span className="aurelius-heading text-base">Ask</span>
        <div className="flex gap-3 items-start">
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
            rows={2}
            placeholder="Ask the library anything — it answers only from what it has absorbed…"
            className="flex-1 bg-black/40 border border-aurelius-gold/25 rounded-lg px-3 py-2 text-sm resize-none outline-none focus:border-aurelius-gold/60"
          />
          <button
            onClick={() => submitAsk()}
            disabled={asking}
            className="px-5 py-2 bg-aurelius-gold text-black text-sm font-semibold rounded-lg disabled:opacity-40"
          >
            {asking ? "Recalling…" : "Ask"}
          </button>
        </div>

        {askError && <p className="text-sm text-red-400/90">{askError}</p>}

        {result && (
          <div className="border-t border-aurelius-gold/15 pt-3 space-y-3 aurelius-resolve">
            <p className="aurelius-voice text-[15px] whitespace-pre-wrap text-neutral-200">{result.answer}</p>
            {result.sources.length > 0 && (
              <div className="text-xs text-neutral-500 space-y-1.5">
                <span className="aurelius-heading text-xs">Drawn from</span>
                {result.sources.map((s, i) => (
                  <div key={i} className="flex items-center gap-2.5">
                    <span className="text-aurelius-gold/70 w-4">{i + 1}</span>
                    <span className="flex-1 truncate">{s.title}</span>
                    <span className="text-neutral-600">{s.sourceType}</span>
                    <span className="aurelius-meter" title={`${(s.similarity * 100).toFixed(0)}% match`}>
                      <span style={{ width: `${Math.max(6, Math.round(s.similarity * 100))}%` }} />
                    </span>
                  </div>
                ))}
              </div>
            )}
            <p className="text-[11px] text-neutral-600">
              {result.recallCount} passages recalled · {result.engine}
            </p>
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* LIBRARY */}
        <section className="lg:col-span-2 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="aurelius-heading text-base mr-2">Library</span>
            <button
              onClick={() => setDomainFilter("")}
              className={`text-xs px-2.5 py-1 rounded-full border ${!domainFilter ? "border-aurelius-gold/60 text-aurelius-gold" : "border-aurelius-gold/20 text-neutral-500"}`}
            >
              all
            </button>
            {domains.map((d) => (
              <button
                key={d}
                onClick={() => setDomainFilter(d === domainFilter ? "" : d)}
                className={`text-xs px-2.5 py-1 rounded-full border ${domainFilter === d ? "border-aurelius-gold/60 text-aurelius-gold" : "border-aurelius-gold/20 text-neutral-500"}`}
              >
                {d}
              </button>
            ))}
          </div>

          {docs !== null && visible.length === 0 && (
            <div className="aurelius-panel-frame p-8 text-center text-neutral-500 text-sm">
              The library is empty. Feed it — every document becomes part of recall,
              and Aurelius stays aware of everything it holds.
            </div>
          )}

          <div className="space-y-3">
            {visible.map((d) => (
              <div key={d.id} className="aurelius-panel-frame p-4">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm font-medium flex-1">
                    <span className="text-aurelius-gold/70 mr-2">{SOURCE_GLYPH[d.sourceType] ?? "◆"}</span>
                    {d.sourceUrl ? (
                      <a href={d.sourceUrl} target="_blank" rel="noreferrer" className="hover:text-aurelius-gold">
                        {d.title}
                      </a>
                    ) : (
                      d.title
                    )}
                  </span>
                  <span className="text-[11px] text-neutral-600 whitespace-nowrap">
                    {d.domain} · {d.chunkCount} chunks · {new Date(d.createdAt).toLocaleDateString()}
                  </span>
                </div>
                {d.summary && <p className="text-xs text-neutral-400 mt-1.5 leading-relaxed">{d.summary}</p>}
              </div>
            ))}
          </div>
        </section>

        {/* FEED IT */}
        <section className="aurelius-panel-frame p-5 space-y-3 self-start border-dashed">
          <span className="aurelius-heading text-base">Feed the brain</span>
          <div className="flex gap-2">
            {(["note", "url"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`text-xs px-3 py-1 rounded-full border ${mode === m ? "border-aurelius-gold/60 text-aurelius-gold" : "border-aurelius-gold/20 text-neutral-500"}`}
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
                className="w-full bg-black/40 border border-aurelius-gold/25 rounded-lg px-3 py-2 text-sm outline-none focus:border-aurelius-gold/60"
              />
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={7}
                placeholder="Paste the material — article, notes, transcript, research…"
                className="w-full bg-black/40 border border-aurelius-gold/25 rounded-lg px-3 py-2 text-sm resize-y outline-none focus:border-aurelius-gold/60"
              />
            </>
          ) : (
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://…"
              className="w-full bg-black/40 border border-aurelius-gold/25 rounded-lg px-3 py-2 text-sm outline-none focus:border-aurelius-gold/60"
            />
          )}

          <input
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="Domain (training, business, personal…) — optional"
            className="w-full bg-black/40 border border-aurelius-gold/25 rounded-lg px-3 py-2 text-sm outline-none focus:border-aurelius-gold/60"
          />

          <button
            onClick={submitIngest}
            disabled={ingesting}
            className="w-full py-2 bg-aurelius-gold text-black text-sm font-semibold rounded-lg disabled:opacity-40"
          >
            {ingesting ? "Absorbing…" : "Ingest"}
          </button>

          {ingestMsg && (
            <p className={`text-xs ${ingestMsg.startsWith("Failed") ? "text-red-400/90" : "text-aurelius-gold/80"}`}>
              {ingestMsg}
            </p>
          )}

          <p className="text-[11px] text-neutral-600 leading-relaxed border-t border-aurelius-gold/15 pt-2">
            Every ingestion: indexed for recall, remembered, registered in
            Aurelius&apos;s awareness, and surfaced on the Bridge.
          </p>
        </section>
      </div>
    </main>
  );
}
