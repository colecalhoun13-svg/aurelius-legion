"use client";

// THE WIKI — what Aurelius understands, in its own words.
// One living page per domain, rewritten as the corpus grows. The corpus
// is what came in; this is the synthesis. Every page also feeds recall.

import { useCallback, useEffect, useState } from "react";

type PageMeta = { slug: string; title: string; domain: string; revision: number; updatedAt: string };
type FullPage = PageMeta & {
  content: string;
  revisions: { revision: number; reason: string | null; createdAt: string }[];
};

// Minimal markdown: headers, bullets, bold. Enough for synthesis pages
// without pulling in a renderer dependency.
function Md({ text }: { text: string }) {
  const bold = (s: string) =>
    s.split(/\*\*(.+?)\*\*/g).map((part, i) =>
      i % 2 === 1 ? <strong key={i} className="text-neutral-100">{part}</strong> : part
    );
  return (
    <div className="space-y-1.5">
      {text.split("\n").map((line, i) => {
        if (line.startsWith("### ")) return <h4 key={i} className="aurelius-heading text-sm mt-4">{line.slice(4)}</h4>;
        if (line.startsWith("## ")) return <h3 key={i} className="aurelius-heading text-base mt-5">{line.slice(3)}</h3>;
        if (line.startsWith("# ")) return <h2 key={i} className="aurelius-heading text-lg mt-2">{line.slice(2)}</h2>;
        if (line.startsWith("- ")) return <p key={i} className="text-sm text-neutral-300 pl-4">· {bold(line.slice(2))}</p>;
        if (line.startsWith("_") && line.endsWith("_"))
          return <p key={i} className="text-xs text-neutral-500 italic">{line.slice(1, -1)}</p>;
        if (!line.trim()) return <div key={i} className="h-1.5" />;
        return <p key={i} className="text-sm text-neutral-300 leading-relaxed">{bold(line)}</p>;
      })}
    </div>
  );
}

export default function WikiPage() {
  const [pages, setPages] = useState<PageMeta[] | null>(null);
  const [active, setActive] = useState<FullPage | null>(null);
  const [rebuilding, setRebuilding] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/wiki");
    if (res.ok) {
      const list = (await res.json()).pages as PageMeta[];
      setPages(list);
      return list;
    }
    return [];
  }, []);

  const open = useCallback(async (slug: string) => {
    const res = await fetch(`/api/wiki?slug=${encodeURIComponent(slug)}`);
    if (res.ok) setActive((await res.json()).page);
  }, []);

  useEffect(() => {
    load().then((list) => {
      if (list.length > 0) open(list[0]!.slug);
    });
  }, [load, open]);

  const rebuild = async () => {
    if (!active || rebuilding) return;
    setRebuilding(true);
    try {
      await fetch("/api/wiki", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: active.slug }),
      });
      await load();
      await open(active.slug);
    } finally {
      setRebuilding(false);
    }
  };

  return (
    <main className="text-aurelius-text max-w-5xl mx-auto space-y-6 aurelius-stagger">
      <header className="flex items-baseline justify-between aurelius-rule">
        <h1 className="aurelius-heading text-4xl">The Wiki</h1>
        <span className="text-sm text-neutral-500">
          {pages === null ? "…" : `${pages.length} living pages`}
        </span>
      </header>

      {pages !== null && pages.length === 0 && (
        <p className="text-neutral-600 italic text-center py-16">
          No syntheses yet. Feed the second brain — Aurelius writes a living page
          per domain as material arrives, and rewrites it as understanding grows.
        </p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
        <aside className="space-y-2 self-start">
          {(pages ?? []).map((p) => (
            <button
              key={p.slug}
              onClick={() => open(p.slug)}
              className={`w-full text-left border rounded-lg px-4 py-3 bg-black/30 transition-colors ${
                active?.slug === p.slug
                  ? "border-aurelius-gold/60"
                  : "border-aurelius-gold/15 hover:border-aurelius-gold/40"
              }`}
            >
              <span className="text-sm text-aurelius-gold block">{p.domain}</span>
              <span className="text-[11px] text-neutral-600">
                rev {p.revision} · {new Date(p.updatedAt).toLocaleDateString()}
              </span>
            </button>
          ))}
        </aside>

        {active && (
          <section className={`lg:col-span-3 aurelius-panel-frame p-6 ${rebuilding ? "aurelius-working" : ""}`}>
            <div className="flex items-baseline justify-between mb-4 pb-3 border-b border-aurelius-gold/15">
              <span className="text-xs text-neutral-500">
                revision {active.revision} · maintained by Aurelius · feeds recall
              </span>
              <button
                onClick={rebuild}
                disabled={rebuilding}
                className="text-xs text-aurelius-gold/80 border border-aurelius-gold/30 rounded px-2.5 py-1 hover:border-aurelius-gold/60 disabled:opacity-40"
              >
                {rebuilding ? "Synthesizing…" : "Rewrite now"}
              </button>
            </div>
            <div className="aurelius-resolve">
              <Md text={active.content} />
            </div>
            {active.revisions.length > 1 && (
              <p className="text-[11px] text-neutral-600 mt-5 pt-3 border-t border-aurelius-gold/15">
                History: {active.revisions.map((r) => `rev ${r.revision} (${r.reason ?? "?"})`).join(" · ")}
              </p>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
