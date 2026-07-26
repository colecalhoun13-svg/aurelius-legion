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
                  : { name, state: "error", detail: j.error ?? "upload didn't land — try again" }
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

// ── THE BOOKCASE ─────────────────────────────────────────────────────
// Every document is a book with a SPINE standing on a bronze rail — the
// library finally looks like a library. Spine width/height/leather are
// deterministic from the title (same book, same spine, every visit).
// Curriculum-studied volumes get the gold-leaf treatment; Cole's drops
// read as darker working bindings.

type Doc = { id: string; title: string; domain: string; sourceType: string };

const LEATHERS = ["#2a2013", "#332211", "#20242f", "#361d1d", "#22301e", "#2d2618", "#1d1a2b"];

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function Spine({ doc }: { doc: Doc }) {
  const h = hashStr(doc.title);
  const isCanon = doc.title.startsWith("Curriculum · ");
  const width = 20 + (h % 15); // 20–34px
  const height = 96 + ((h >> 4) % 44); // 96–139px
  const leather = LEATHERS[(h >> 8) % LEATHERS.length];
  const title = doc.title.replace(/^Curriculum · /, "");
  return (
    <div
      title={doc.title}
      className="shrink-0 rounded-t-[3px] cursor-default transition-transform duration-200 hover:-translate-y-1.5 hover:drop-shadow-[0_0_10px_rgba(212,175,55,0.45)]"
      style={{
        width,
        height,
        background: `linear-gradient(105deg, ${leather} 0%, ${leather} 55%, rgba(255,255,255,0.06) 58%, ${leather} 62%, ${leather} 100%)`,
        border: "1px solid rgba(212,175,55,0.22)",
        borderBottom: "none",
        boxShadow: isCanon
          ? "inset 0 6px 0 rgba(212,175,55,0.5), inset 0 -8px 0 rgba(212,175,55,0.35), inset 2px 0 4px rgba(0,0,0,0.5)"
          : "inset 0 5px 0 rgba(212,175,55,0.18), inset 0 -6px 0 rgba(212,175,55,0.12), inset 2px 0 4px rgba(0,0,0,0.5)",
      }}
    >
      <div
        className="h-full w-full flex items-center justify-center overflow-hidden px-[2px] pt-3 pb-2"
        style={{ writingMode: "vertical-rl" }}
      >
        <span
          className="text-[9px] tracking-wide truncate"
          style={{ color: isCanon ? "#e6cf8f" : "#b9a468", maxHeight: height - 26, fontFamily: "Georgia, serif" }}
        >
          {title}
        </span>
      </div>
    </div>
  );
}

function Shelf({
  label, read, total, cycles, books, busy, onStudy, studyable,
}: {
  label: string; read?: number; total?: number; cycles?: number;
  books: Doc[]; busy: boolean; onStudy?: () => void; studyable: boolean;
}) {
  const shown = books.slice(0, 40);
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 mb-1 px-1">
        <span className="aurelius-heading text-sm text-aurelius-gold/80">{label}</span>
        <span className="flex items-center gap-3 shrink-0 text-[11px] text-neutral-500">
          {typeof read === "number" && typeof total === "number" && (
            <span>
              {read}/{total} studied{(cycles ?? 0) > 0 && <span> · {cycles}× deepened</span>}
            </span>
          )}
          {books.length > 40 && <span>+{books.length - 40} more</span>}
          {studyable && onStudy && (
            <button
              onClick={onStudy}
              disabled={busy}
              className="text-xs border border-aurelius-gold/40 rounded-lg px-3 py-1 hover:bg-aurelius-gold/15 text-aurelius-gold disabled:opacity-50"
            >
              {busy ? "Studying…" : "Study now"}
            </button>
          )}
        </span>
      </div>
      {/* the books, standing on the rail */}
      <div className="flex items-end gap-[3px] px-2 pt-2 min-h-[120px] overflow-x-auto overflow-y-hidden">
        {shown.length > 0 ? (
          shown.map((b) => <Spine key={b.id} doc={b} />)
        ) : (
          <span className="text-xs text-neutral-600 italic pb-2">empty shelf — drop something into this field</span>
        )}
      </div>
      {/* the bronze rail */}
      <div
        className="h-[10px] rounded-[2px]"
        style={{
          background: "linear-gradient(180deg, #9a7a3a 0%, #6b5326 30%, #3a2d14 100%)",
          boxShadow: "0 4px 10px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,235,180,0.35)",
        }}
      />
    </div>
  );
}

export default function ShelvesPanel() {
  const [lib, setLib] = useState<Library | null>(null);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [libRes, corpusRes] = await Promise.all([fetch("/api/library"), fetch("/api/corpus")]);
      if (!libRes.ok) throw new Error("Aurelius couldn't load the library right now — try again in a moment.");
      setLib(await libRes.json());
      if (corpusRes.ok) setDocs((await corpusRes.json()).documents ?? []);
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
  const totalBooks = docs.length;

  // Shelves: one per curriculum field (its docs shelved with it), then one
  // per leftover corpus domain (drops, research, training…), fullest first.
  const fieldDomains = new Set((lib?.progress ?? []).map((s) => s.domain));
  const byDomain = new Map<string, Doc[]>();
  for (const d of docs) {
    byDomain.set(d.domain, [...(byDomain.get(d.domain) ?? []), d]);
  }
  const extraShelves = [...byDomain.entries()]
    .filter(([domain]) => !fieldDomains.has(domain))
    .sort((a, b) => b[1].length - a[1].length);

  return (
    <div className="text-aurelius-text max-w-3xl mx-auto space-y-8 aurelius-stagger">
      <header className="flex items-baseline justify-between aurelius-rule">
        <h1 className="aurelius-heading text-4xl">The Shelves</h1>
        <span className="text-sm text-neutral-500">
          {lib === null ? "…" : `${totalBooks} volumes · ${totalRead} studied`}
        </span>
      </header>
      <p className="text-sm text-neutral-500">
        Every volume on these shelves is real — gold-leafed spines are the canon Aurelius has studied; darker
        bindings are what you&apos;ve fed it. It reads the next unit every Sunday and grows its own list.
      </p>

      {err && <p className="text-red-400 text-sm">Couldn&apos;t load: {err}</p>}

      {/* Research Drop — feed the brain from the browser */}
      <ResearchDrop onIngested={load} />

      {/* The bookcase */}
      <section className="space-y-7">
        {(lib?.progress ?? []).map((s) => (
          <Shelf
            key={s.domain}
            label={s.label}
            read={s.read}
            total={s.total}
            cycles={s.cycles}
            books={byDomain.get(s.domain) ?? []}
            busy={busy === s.domain}
            onStudy={() => studyNow(s.domain)}
            studyable
          />
        ))}
        {extraShelves.map(([domain, books]) => (
          <Shelf key={domain} label={domain.replace(/_/g, " ")} books={books} busy={false} studyable={false} />
        ))}
      </section>
    </div>
  );
}
