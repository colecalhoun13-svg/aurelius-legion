"use client";

// THE LIBRARY — what each operator has studied, and what it's studying next.
// The curriculum feeds the second brain + wiki; this is the shelf Cole can watch
// fill week over week, and steer (study a field now).

import { useCallback, useEffect, useState } from "react";

type Shelf = { domain: string; label: string; read: number; total: number; discovered: number; cycles: number };
type Recent = { id: string; title: string; domain: string; createdAt: string };
type Library = { progress: Shelf[]; recent: Recent[] };

type DropStatus = { name: string; state: "uploading" | "ingested" | "duplicate" | "error"; detail?: string };

// RESEARCH DROP — drag a PDF/note here and it enters the second brain:
// indexed for recall, remembered, and on the Bridge. Same hardened pipeline
// as the inbox folder, no filesystem required.
function ResearchDrop({ onIngested }: { onIngested: () => void }) {
  const [over, setOver] = useState(false);
  const [drops, setDrops] = useState<DropStatus[]>([]);

  const upload = useCallback(
    async (files: FileList | File[]) => {
      for (const file of Array.from(files)) {
        const name = file.name;
        if (!/\.(md|txt|pdf)$/i.test(name)) {
          setDrops((d) => [{ name, state: "error" as const, detail: "only .md / .txt / .pdf" }, ...d].slice(0, 6));
          continue;
        }
        if (file.size > 20 * 1024 * 1024) {
          setDrops((d) => [{ name, state: "error" as const, detail: "over the 20MB cap — split it" }, ...d].slice(0, 6));
          continue;
        }
        setDrops((d) => [{ name, state: "uploading" as const }, ...d].slice(0, 6));
        try {
          const buf = await file.arrayBuffer();
          let bin = "";
          const bytes = new Uint8Array(buf);
          for (let i = 0; i < bytes.length; i += 0x8000) {
            bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
          }
          const res = await fetch("/api/corpus/upload", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ filename: name, contentBase64: btoa(bin) }),
          });
          const j = await res.json().catch(() => ({}));
          setDrops((d) =>
            d.map((s) =>
              s.name === name && s.state === "uploading"
                ? j.ok
                  ? { name, state: j.deduped ? "duplicate" : "ingested", detail: j.deduped ? "already in the brain" : `${j.chunkCount ?? 0} chunks indexed` }
                  : { name, state: "error", detail: j.error ?? `HTTP ${res.status}` }
                : s
            )
          );
          if (j.ok && !j.deduped) onIngested();
        } catch (e: any) {
          setDrops((d) =>
            d.map((s) => (s.name === name && s.state === "uploading" ? { name, state: "error", detail: e?.message ?? "upload failed" } : s))
          );
        }
      }
    },
    [onIngested]
  );

  return (
    <section
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); if (e.dataTransfer.files.length) upload(e.dataTransfer.files); }}
      className={`aurelius-panel-frame border rounded-lg p-5 text-center transition-colors ${
        over ? "border-aurelius-gold bg-aurelius-gold/10" : "border-aurelius-gold/25"
      }`}
    >
      <p className="text-sm text-aurelius-gold aurelius-heading tracking-widest">Research Drop</p>
      <p className="mt-1 text-xs text-neutral-500">
        Drop PDFs, notes, or books here (.pdf / .md / .txt, ≤20MB — split books by chapter) and they enter the second
        brain: recall, memory, the Bridge. Scanned PDFs wait for the Mini&apos;s OCR.
      </p>
      <label className="mt-3 inline-block cursor-pointer text-xs border border-aurelius-gold/40 rounded-lg px-3 py-1.5 hover:bg-aurelius-gold/15 text-aurelius-gold">
        or choose files
        <input
          type="file"
          multiple
          accept=".pdf,.md,.txt"
          className="hidden"
          onChange={(e) => { if (e.target.files?.length) upload(e.target.files); e.target.value = ""; }}
        />
      </label>
      {drops.length > 0 && (
        <ul className="mt-3 space-y-1 text-left">
          {drops.map((s, i) => (
            <li key={`${s.name}-${i}`} className="text-[11px] flex items-start gap-2">
              <span className={s.state === "error" ? "text-red-400" : s.state === "uploading" ? "text-neutral-500" : "text-aurelius-gold/80"}>
                {s.state === "uploading" ? "…" : s.state === "error" ? "✗" : "✦"}
              </span>
              <span className="text-neutral-400">
                {s.name}
                <span className="text-neutral-600"> · {s.state === "uploading" ? "reading" : s.detail ?? s.state}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function LibraryPage() {
  const [lib, setLib] = useState<Library | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/library");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setLib(await res.json());
    } catch (e: any) {
      setErr(e?.message ?? "failed to load");
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const studyNow = useCallback(async (domain: string) => {
    if (busy) return;
    setBusy(domain);
    try {
      const res = await fetch("/api/library", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) window.alert(`Couldn't study: ${j.error ?? res.status}`);
      else if ((j.studied?.length ?? 0) === 0) {
        window.alert(j.skipped?.[0]?.reason ? `Nothing studied — ${j.skipped[0].reason}` : "Nothing studied (no engine?).");
      }
      await load();
    } finally {
      setBusy(null);
    }
  }, [busy, load]);

  const totalRead = lib?.progress.reduce((n, s) => n + s.read, 0) ?? 0;

  return (
    <main className="text-aurelius-text max-w-3xl mx-auto space-y-6 aurelius-stagger">
      <header className="flex items-baseline justify-between aurelius-rule">
        <h1 className="aurelius-heading text-4xl">The Library</h1>
        <span className="text-sm text-neutral-500">{lib === null ? "…" : `${totalRead} studied`}</span>
      </header>
      <p className="text-sm text-neutral-500">
        What each operator has read and understood — works and the concepts of the field itself. It studies the next
        unit every Sunday, grows its own reading list, and distills what it learns into principles you confirm.
      </p>

      {err && <p className="text-red-400 text-sm">Couldn't load: {err}</p>}

      {/* Research Drop — feed the brain from the browser */}
      <ResearchDrop onIngested={load} />

      {/* The shelves */}
      <section className="space-y-3">
        {(lib?.progress ?? []).map((s) => {
          const pct = s.total > 0 ? Math.round((s.read / s.total) * 100) : 0;
          return (
            <div key={s.domain} className="aurelius-panel-frame p-4 border border-aurelius-gold/20">
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium text-sm">{s.label}</span>
                <span className="flex items-center gap-3 shrink-0">
                  <span className="text-[11px] text-neutral-500">
                    {s.read}/{s.total}
                    {s.discovered > 0 && <span className="text-aurelius-gold/60"> · +{s.discovered} discovered</span>}
                    {s.cycles > 0 && <span className="text-neutral-600"> · {s.cycles}× deepened</span>}
                  </span>
                  <button
                    onClick={() => studyNow(s.domain)}
                    disabled={busy === s.domain}
                    className="text-xs border border-aurelius-gold/40 rounded-lg px-3 py-1 hover:bg-aurelius-gold/15 text-aurelius-gold disabled:opacity-50"
                  >
                    {busy === s.domain ? "Studying…" : "Study now"}
                  </button>
                </span>
              </div>
              <div className="mt-2 h-1.5 w-full rounded bg-neutral-800 overflow-hidden">
                <div className="h-full bg-aurelius-gold/70" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </section>

      {/* Recently studied */}
      {lib?.recent && lib.recent.length > 0 && (
        <section>
          <h2 className="aurelius-heading text-lg mb-2">Recently studied</h2>
          <ul className="space-y-1.5">
            {lib.recent.map((r) => (
              <li key={r.id} className="text-xs text-neutral-500 flex items-start gap-2 px-1">
                <span className="text-aurelius-gold/60 mt-px">✦</span>
                <span>
                  <span className="text-neutral-400">{r.title}</span>
                  <span className="text-neutral-600"> · {new Date(r.createdAt).toLocaleDateString([], { month: "short", day: "numeric" })}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
