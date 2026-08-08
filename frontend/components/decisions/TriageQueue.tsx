"use client";

// INBOX — triage. Everything captured or proposed lands here untriaged;
// one tap routes it: Today / Next / Later / Done / Drop.
//
// ELEVATED IMPERIAL re-dress: stone-slab cards, Cormorant-caps ruling
// buttons, and the same ruled-card exit as the bench — routing a task is
// a ruling too. Handlers and the honest-failure error line are unchanged.

import { useCallback, useEffect, useRef, useState } from "react";
import { Btn, Panel, SectionLabel } from "../kit";

type Task = { id: string; title: string; priority: string; domain: string; origin: string };

function localDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export default function InboxPage() {
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r2 = await fetch("/api/inbox");
      if (!r2.ok) throw new Error("Aurelius couldn't load the inbox right now — try again in a moment.");
      setTasks(await r2.json());
      setErr(null);
    } catch (e: any) {
      setErr(e?.message ?? "failed to load");
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // The ruled exit — identical grammar to the bench (inline transition,
  // measure → double-rAF → collapse; reduced-motion routes instantly).
  const cardRefs = useRef(new Map<string, HTMLElement>());
  const setCardRef = (id: string) => (node: HTMLElement | null) => {
    if (node) cardRefs.current.set(id, node);
    else cardRefs.current.delete(id);
  };
  const animateAway = async (id: string) => {
    const el = cardRefs.current.get(id);
    if (!el) return;
    if (typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    el.style.overflow = "hidden";
    el.style.transition =
      "opacity .5s var(--au-ease), transform .5s var(--au-ease), max-height .55s var(--au-ease), margin .55s var(--au-ease)";
    el.style.maxHeight = el.scrollHeight + "px";
    await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
    el.style.opacity = "0";
    el.style.transform = "translateX(28px)";
    el.style.maxHeight = "0";
    el.style.marginTop = "0";
    el.style.marginBottom = "0";
    await sleep(560);
  };
  const resetCard = (id: string) => {
    const el = cardRefs.current.get(id);
    if (!el) return;
    for (const p of ["overflow", "transition", "opacity", "transform", "max-height", "margin-top", "margin-bottom"])
      el.style.removeProperty(p);
  };

  const route = async (id: string, status: string) => {
    const res = await fetch("/api/today/actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "routeTask", id, status, date: localDate() }),
    });
    if (res.ok) await animateAway(id);
    await load();
    resetCard(id);
  };

  return (
    <main className="text-aurelius-text max-w-3xl mx-auto space-y-6">
      <header>
        <div className="flex items-baseline justify-between gap-4 flex-wrap">
          <SectionLabel row>Triage</SectionLabel>
          <span className="au-kicker">{tasks === null ? "…" : `${tasks.length} to triage`}</span>
        </div>
        <div className="au-rule" />
      </header>
      {err && <p className="text-sm text-amber-300/90">{err}</p>}

      {tasks && tasks.length === 0 && (
        <p className="au-kicker text-center py-16" style={{ display: "block", fontSize: "1.05rem" }}>
          Inbox zero. As it should be.
        </p>
      )}

      <ul className="space-y-3">
        {(tasks ?? []).map((t) => (
          <li key={t.id} ref={setCardRef(t.id)}>
            <Panel tier="card">
              <div className="flex items-center justify-between gap-3">
                <span style={{ color: "var(--ink)" }}>{t.title}</span>
                {t.origin !== "cole" && (
                  <span
                    className="shrink-0"
                    style={{
                      fontFamily: "var(--font-body),Georgia,serif",
                      fontWeight: 600,
                      fontSize: 11.5,
                      letterSpacing: ".26em",
                      textTransform: "uppercase",
                      color: "var(--gold)",
                    }}
                  >
                    proposed
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                <Btn
                  ghost
                  onClick={() => route(t.id, "today")}
                  style={{ color: "var(--gold)", borderColor: "var(--gold-line)" }}
                >
                  Today
                </Btn>
                <Btn ghost onClick={() => route(t.id, "next")}>Next</Btn>
                <Btn ghost onClick={() => route(t.id, "later")}>Later</Btn>
                <Btn ghost onClick={() => route(t.id, "done")} style={{ color: "var(--money)" }}>
                  Done
                </Btn>
                <Btn ghost onClick={() => route(t.id, "abandoned")} style={{ color: "var(--ink3)" }}>
                  Drop
                </Btn>
              </div>
            </Panel>
          </li>
        ))}
      </ul>
    </main>
  );
}
