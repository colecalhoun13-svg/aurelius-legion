"use client";

// SHARE TARGET — the phone's share sheet feeds the second brain. Share an
// article from Safari/anywhere → this page receives {title, text, url},
// ingests it, and shows the receipt. The under-5-seconds capture reflex.

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

function ShareInner() {
  const params = useSearchParams();
  const [state, setState] = useState<"working" | "done" | "error">("working");
  const [detail, setDetail] = useState("");
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return; // strict-mode double-mount guard — ingest once
    fired.current = true;

    const url = params.get("url")?.trim() || "";
    const text = params.get("text")?.trim() || "";
    const title = params.get("title")?.trim() || "";
    // Some apps put the link in `text` — find it either way.
    const linkInText = text.match(/https?:\/\/\S+/)?.[0] ?? "";
    const link = url || linkInText;

    const run = async () => {
      try {
        if (link) {
          const r = await fetch("/api/corpus", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: link }),
          });
          const j = await r.json().catch(() => ({}));
          if (!r.ok) throw new Error(j.error ?? "the page wouldn't ingest");
          setDetail(j.doc?.title ?? link);
        } else if (text || title) {
          const r = await fetch("/api/corpus", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title: title || "Shared note", content: text || title }),
          });
          const j = await r.json().catch(() => ({}));
          if (!r.ok) throw new Error(j.error ?? "the note wouldn't save");
          setDetail(j.doc?.title ?? title ?? "note");
        } else {
          throw new Error("nothing was shared");
        }
        setState("done");
      } catch (e: any) {
        setDetail(e?.message ?? "something went sideways");
        setState("error");
      }
    };
    run();
  }, [params]);

  return (
    <main className="text-aurelius-text max-w-md mx-auto pt-16 text-center space-y-6 aurelius-stagger">
      <h1 className="aurelius-heading text-3xl">Into the Brain</h1>
      {state === "working" && <p className="text-neutral-400 text-sm">Reading what you shared…</p>}
      {state === "done" && (
        <div className="aurelius-panel-frame border border-aurelius-gold/30 p-5">
          <p className="text-aurelius-gold text-sm">✦ Ingested</p>
          <p className="text-neutral-300 text-sm mt-2 break-words">{detail}</p>
          <p className="text-neutral-500 text-xs mt-3">Indexed for recall — ask about it any time.</p>
        </div>
      )}
      {state === "error" && (
        <div className="aurelius-panel-frame border border-red-400/40 p-5">
          <p className="text-red-400 text-sm">Couldn&apos;t take that one</p>
          <p className="text-neutral-400 text-sm mt-2">{detail}</p>
        </div>
      )}
      <div className="flex justify-center gap-4 text-sm">
        <Link href="/home" className="text-aurelius-gold border border-aurelius-gold/40 rounded-lg px-4 py-2 hover:bg-aurelius-gold/15">
          Home
        </Link>
        <Link href="/brain" className="text-aurelius-gold border border-aurelius-gold/40 rounded-lg px-4 py-2 hover:bg-aurelius-gold/15">
          The Brain
        </Link>
      </div>
    </main>
  );
}

export default function SharePage() {
  return (
    <Suspense fallback={<main className="text-neutral-500 text-sm text-center pt-16">…</main>}>
      <ShareInner />
    </Suspense>
  );
}
