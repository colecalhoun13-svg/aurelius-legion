"use client";

// THE LIBRARY — what each operator has studied, and what it's studying next.
// The curriculum feeds the second brain + wiki; this is the shelf Cole can watch
// fill week over week, and steer (study a field now).
// v2: the shelves finally OPEN — click a spine (or a Catalog row) and the
// volume's full text opens in a reader. Deep-linkable via ?doc=<id>.

import { useCallback, useEffect, useRef, useState } from "react";
import { SparkLine } from "../viz/Spark";

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

type Doc = { id: string; title: string; domain: string; sourceType: string; createdAt?: string };

const LEATHERS = ["#2a2013", "#332211", "#20242f", "#361d1d", "#22301e", "#2d2618", "#1d1a2b"];

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function Spine({ doc, onOpen }: { doc: Doc; onOpen: (id: string) => void }) {
  const h = hashStr(doc.title);
  const isCanon = doc.title.startsWith("Curriculum · ");
  const width = 20 + (h % 15); // 20–34px
  const height = 96 + ((h >> 4) % 44); // 96–139px
  const leather = LEATHERS[(h >> 8) % LEATHERS.length];
  const title = doc.title.replace(/^Curriculum · /, "");
  return (
    <div
      title={`${doc.title} — open it`}
      onClick={() => onOpen(doc.id)}
      className="shrink-0 rounded-t-[3px] cursor-pointer transition-transform duration-200 hover:-translate-y-1.5 hover:drop-shadow-[0_0_10px_rgba(212,175,55,0.45)]"
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
  label, read, total, cycles, books, busy, onStudy, studyable, onOpen,
}: {
  label: string; read?: number; total?: number; cycles?: number;
  books: Doc[]; busy: boolean; onStudy?: () => void; studyable: boolean;
  onOpen: (id: string) => void;
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
          shown.map((b) => <Spine key={b.id} doc={b} onOpen={onOpen} />)
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

// ── THE READER ───────────────────────────────────────────────────────
// A volume off the shelf, whole: full-width, real reading typography, the
// provenance in the header. Cole's own ask — "go in and read all the
// sources it's collected." Actions stay honest: ask-about-this routes to
// the Ask tab; forget is confirm-gated and removes text, embeddings, memory.

type FullDoc = {
  id: string; title: string; domain: string; sourceType: string;
  sourceUrl?: string | null; summary?: string | null; chunkCount?: number;
  createdAt?: string; contentText?: string;
};

function ReaderView({ id, onClose, onForgotten }: { id: string; onClose: () => void; onForgotten: () => void }) {
  const [doc, setDoc] = useState<FullDoc | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [forgetting, setForgetting] = useState(false);

  useEffect(() => {
    let alive = true;
    setDoc(null);
    setErr(null);
    fetch(`/api/corpus/${id}`)
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error ?? "this volume isn't on the shelves");
        if (alive) setDoc(j.document);
      })
      .catch((e: any) => { if (alive) setErr(e?.message ?? "failed to open"); });
    return () => { alive = false; };
  }, [id]);

  const forget = async () => {
    if (!doc || forgetting) return;
    if (!window.confirm(`Forget "${doc.title}"?\n\nIts text, embeddings, and Aurelius's memory of it are removed. This can't be undone.`)) return;
    setForgetting(true);
    try {
      const res = await fetch(`/api/corpus/${id}`, { method: "DELETE" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) window.alert(`Couldn't forget: ${j.error ?? res.status}`);
      else onForgotten();
    } finally {
      setForgetting(false);
    }
  };

  const isCanon = doc?.title.startsWith("Curriculum · ") ?? false;
  const words = doc?.contentText ? doc.contentText.trim().split(/\s+/).length : 0;

  return (
    <div className="text-aurelius-text max-w-3xl mx-auto space-y-5 aurelius-stagger">
      <button onClick={onClose} className="text-sm text-neutral-500 hover:text-aurelius-gold">
        ← The Shelves
      </button>

      {err && <p className="text-red-400 text-sm">Couldn&apos;t open this volume: {err}</p>}
      {!doc && !err && <p className="text-neutral-500 text-sm italic">Taking it off the shelf…</p>}

      {doc && (
        <article>
          <header className="aurelius-rule pb-4">
            <h1 className="aurelius-heading text-3xl">{doc.title.replace(/^Curriculum · /, "")}</h1>
            <p className="text-xs text-neutral-500 mt-2">
              {doc.domain.replace(/_/g, " ")} · {doc.sourceType}
              {doc.createdAt && (
                <> · collected {new Date(doc.createdAt).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}</>
              )}
              {words > 0 && <> · {words.toLocaleString()} words</>}
              {isCanon && <span className="text-aurelius-gold/80"> · gold-leaf canon</span>}
            </p>
            {doc.sourceUrl && (
              <a
                href={doc.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="block text-xs text-aurelius-gold/70 hover:text-aurelius-gold underline underline-offset-2 break-all mt-1"
              >
                {doc.sourceUrl}
              </a>
            )}
            <div className="flex gap-2 mt-3">
              <button
                onClick={() =>
                  window.location.assign(
                    `/brain?ask=${encodeURIComponent(`From "${doc.title}": give me the key points and how to use them.`)}`
                  )
                }
                className="text-xs border border-aurelius-gold/40 rounded-lg px-3 py-1.5 text-aurelius-gold hover:bg-aurelius-gold/15"
              >
                Ask about this
              </button>
              <button
                onClick={forget}
                disabled={forgetting}
                className="text-xs border border-red-400/40 rounded-lg px-3 py-1.5 text-red-300/90 hover:bg-red-500/10 disabled:opacity-50"
              >
                {forgetting ? "Forgetting…" : "Forget"}
              </button>
            </div>
          </header>

          {doc.summary && <p className="text-sm text-neutral-400 italic mt-4">{doc.summary}</p>}

          <div
            className="mt-5 text-[15px] leading-[1.75] whitespace-pre-wrap max-w-[65ch] text-neutral-200"
            style={{ fontFamily: "Georgia, serif" }}
          >
            {doc.contentText?.trim() ? doc.contentText : <span className="text-neutral-600 italic">No text stored for this volume.</span>}
          </div>
        </article>
      )}
    </div>
  );
}

export default function ShelvesPanel() {
  const [lib, setLib] = useState<Library | null>(null);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [view, setView] = useState<"shelves" | "catalog">("shelves");
  const [reading, setReading] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [sortKey, setSortKey] = useState<"createdAt" | "title" | "domain">("createdAt");
  const [sortDir, setSortDir] = useState<1 | -1>(-1);
  const [growth, setGrowth] = useState<(number | null)[]>([]);
  const pushedRef = useRef(false);

  // The library growing — cumulative volumes by week (last 12).
  useEffect(() => {
    fetch("/api/scoreboard")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        const dates: string[] = j?.corpusDates ?? [];
        if (!dates.length) return;
        const now = Date.now();
        const weeks = Array.from({ length: 12 }, (_, i) => now - (11 - i) * 7 * 86400_000);
        setGrowth(weeks.map((end) => dates.filter((d) => new Date(d).getTime() <= end).length));
      })
      .catch(() => {});
  }, []);

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

  // ?doc=<id> deep link + back-button honesty: opening a volume pushes a
  // history entry; the browser's back closes the book instead of leaving.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get("doc")) setReading(p.get("doc"));
    const onPop = () => {
      const sp = new URLSearchParams(window.location.search);
      setReading(sp.get("doc"));
      if (!sp.get("doc")) pushedRef.current = false;
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const openDoc = useCallback((id: string) => {
    const u = new URL(window.location.href);
    u.searchParams.set("doc", id);
    window.history.pushState({}, "", u);
    pushedRef.current = true;
    setReading(id);
  }, []);

  const closeDoc = useCallback(() => {
    if (pushedRef.current) {
      window.history.back();
    } else {
      const u = new URL(window.location.href);
      u.searchParams.delete("doc");
      window.history.replaceState({}, "", u);
      setReading(null);
    }
  }, []);

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

  // A volume is open: the reader replaces the shelves, full width.
  if (reading) {
    return <ReaderView id={reading} onClose={closeDoc} onForgotten={() => { closeDoc(); load(); }} />;
  }

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

  // Catalog: the same volumes as a findable list — search, sort, open.
  const ql = q.trim().toLowerCase();
  const catalog = docs
    .filter((d) => !ql || `${d.title} ${d.domain}`.toLowerCase().includes(ql))
    .slice()
    .sort((a, b) => {
      const av = sortKey === "createdAt" ? a.createdAt ?? "" : sortKey === "title" ? a.title.toLowerCase() : a.domain;
      const bv = sortKey === "createdAt" ? b.createdAt ?? "" : sortKey === "title" ? b.title.toLowerCase() : b.domain;
      return av < bv ? -sortDir : av > bv ? sortDir : 0;
    });

  const sortBtn = (key: typeof sortKey, label: string) => (
    <button
      onClick={() => {
        if (sortKey === key) setSortDir((d) => (d === 1 ? -1 : 1));
        else { setSortKey(key); setSortDir(key === "createdAt" ? -1 : 1); }
      }}
      className={`text-[11px] uppercase tracking-widest ${sortKey === key ? "text-aurelius-gold" : "text-neutral-600 hover:text-aurelius-gold/70"}`}
    >
      {label}
      {sortKey === key ? (sortDir === 1 ? " ↑" : " ↓") : ""}
    </button>
  );

  return (
    <div className="text-aurelius-text max-w-3xl mx-auto space-y-8 aurelius-stagger">
      <header className="flex items-baseline justify-between aurelius-rule">
        <h1 className="aurelius-heading text-4xl">The Shelves</h1>
        <span className="flex items-center gap-3 text-sm text-neutral-500">
          {growth.length > 1 && (growth[growth.length - 1] ?? 0) > (growth[0] ?? 0) && (
            <span title="volumes collected — last 12 weeks" className="hidden sm:inline-flex">
              <SparkLine values={growth} width={110} height={30} />
            </span>
          )}
          <span>{lib === null ? "…" : `${totalBooks} volumes · ${totalRead} studied`}</span>
          <span className="flex border border-aurelius-gold/30 rounded-lg overflow-hidden text-xs">
            <button
              onClick={() => setView("shelves")}
              className={`px-3 py-1 ${view === "shelves" ? "bg-aurelius-gold/15 text-aurelius-gold" : "text-neutral-500 hover:text-aurelius-gold"}`}
            >
              Shelves
            </button>
            <button
              onClick={() => setView("catalog")}
              className={`px-3 py-1 ${view === "catalog" ? "bg-aurelius-gold/15 text-aurelius-gold" : "text-neutral-500 hover:text-aurelius-gold"}`}
            >
              Catalog
            </button>
          </span>
        </span>
      </header>
      <p className="text-sm text-neutral-500">
        Every volume on these shelves is real — gold-leafed spines are the canon Aurelius has studied; darker
        bindings are what you&apos;ve fed it. Click any spine to open it and read. It reads the next unit every
        Sunday and grows its own list.
      </p>

      {err && <p className="text-red-400 text-sm">Couldn&apos;t load: {err}</p>}

      {/* Research Drop — feed the brain from the browser */}
      <ResearchDrop onIngested={load} />

      {view === "shelves" ? (
        /* The bookcase */
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
              onOpen={openDoc}
            />
          ))}
          {extraShelves.map(([domain, books]) => (
            <Shelf key={domain} label={domain.replace(/_/g, " ")} books={books} busy={false} studyable={false} onOpen={openDoc} />
          ))}
        </section>
      ) : (
        /* The catalog — findability beside the charm */
        <section className="space-y-3">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Find a volume by title or field…"
            className="w-full bg-black/40 border border-aurelius-gold/25 rounded-lg px-3 py-2 text-sm outline-none focus:border-aurelius-gold/60"
          />
          <div className="flex items-center gap-4 px-1">
            {sortBtn("createdAt", "Added")}
            {sortBtn("title", "Title")}
            {sortBtn("domain", "Field")}
            <span className="ml-auto text-[11px] text-neutral-600">{catalog.length} shown</span>
          </div>
          <ul className="divide-y divide-aurelius-gold/10 border border-aurelius-gold/20 rounded-lg overflow-hidden">
            {catalog.map((d) => (
              <li key={d.id}>
                <button
                  onClick={() => openDoc(d.id)}
                  className="w-full text-left px-4 py-2.5 flex items-baseline gap-3 hover:bg-aurelius-gold/5"
                >
                  <span className="text-sm text-neutral-200 flex-1 truncate">
                    {d.title.startsWith("Curriculum · ") && <span className="text-aurelius-gold/80 mr-1">✦</span>}
                    {d.title.replace(/^Curriculum · /, "")}
                  </span>
                  <span className="text-[11px] text-neutral-600 shrink-0">{d.domain.replace(/_/g, " ")}</span>
                  {d.createdAt && (
                    <span className="text-[11px] text-neutral-600 shrink-0 w-16 text-right">
                      {new Date(d.createdAt).toLocaleDateString([], { month: "short", day: "numeric" })}
                    </span>
                  )}
                </button>
              </li>
            ))}
            {catalog.length === 0 && (
              <li className="px-4 py-6 text-center text-sm text-neutral-600 italic">
                {docs.length === 0 ? "Nothing collected yet — drop something above." : "No volume matches that."}
              </li>
            )}
          </ul>
        </section>
      )}
    </div>
  );
}
