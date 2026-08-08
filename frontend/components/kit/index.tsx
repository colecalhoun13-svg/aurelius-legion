"use client";
// components/kit — the ELEVATED IMPERIAL primitives (docs/REDESIGN_PLAN.md).
// Every page converges on these instead of hand-rolled class strings; style
// changes flow through here. Zero fetch, zero domain types.
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";

/* ── formatting ── */
export const money = (cents: number, currency = "usd") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
export const day = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—";

/* ── SectionLabel: engraved small-cap serif, flanking hairlines ── */
export function SectionLabel({ children, row, gold, className = "" }: {
  children: React.ReactNode; row?: boolean; gold?: boolean; className?: string;
}) {
  return (
    <div className={`${row ? "au-label-row" : "au-label"} ${className}`}
      style={gold ? { color: "var(--gold)" } : undefined}>
      {children}
    </div>
  );
}

/* ── Divider: the laurel (or column capital) between movements ── */
export function Divider({ capital }: { capital?: boolean }) {
  return <div className="au-divider" aria-hidden="true"><i className={capital ? "capital" : ""} /></div>;
}

/* ── Tick: the laurel mark — "an act" ── */
export function Tick({ em, hollow, className = "" }: { em?: boolean; hollow?: boolean; className?: string }) {
  return <i className={`au-tick ${em ? "au-tick-em" : ""} ${hollow ? "au-tick-hollow" : ""} ${className}`} aria-hidden="true" />;
}

/* ── Panel: three surface tiers. glass = inscription tablet (max ~2/page);
      card = stone slab; open = bare air with a label + rule. ── */
export function Panel({ tier = "open", id, label, labelGold, headerRight, className = "", style, children }: {
  tier?: "open" | "card" | "glass";
  id?: string; label?: React.ReactNode; labelGold?: boolean; headerRight?: React.ReactNode;
  className?: string; style?: React.CSSProperties; children: React.ReactNode;
}) {
  const surface = tier === "glass" ? "au-tablet p-6" : tier === "card" ? "au-card p-4" : "";
  return (
    <section id={id} className={`${surface} scroll-mt-24 ${className}`} style={style}>
      {label != null && (
        headerRight != null ? (
          <div className="flex items-baseline justify-between gap-4 flex-wrap">
            <SectionLabel row gold={labelGold}>{label}</SectionLabel>
            {headerRight}
          </div>
        ) : <SectionLabel gold={labelGold}>{label}</SectionLabel>
      )}
      {label != null && <div style={{ height: "0.9rem" }} />}
      {children}
    </section>
  );
}

/* ── Btn: letterpress serif caps ── */
export function Btn({ ghost, className = "", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { ghost?: boolean }) {
  return <button className={`${ghost ? "au-btn-ghost" : "au-btn"} ${className}`} {...props} />;
}

/* ── useCountUp: rAF ease-out tween. Zeroes never animate (honest-empty). ── */
export function useCountUp(target: number, duration = 900) {
  const [val, setVal] = useState(target);
  const prev = useRef<number | null>(null);
  useEffect(() => {
    const from = prev.current ?? 0;
    prev.current = target;
    if (from === target || target === 0 ||
        (typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches)) {
      setVal(target); return;
    }
    const t0 = performance.now(); let raf = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / duration);
      setVal(from + (target - from) * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return val;
}

/* ── Stat: the scoreboard figure — big Cinzel numeral over a gold baseline ── */
export function Stat({ label, value, unit, pct = 100, hint, tone, countUpCents }: {
  label: React.ReactNode; value?: React.ReactNode; unit?: string; pct?: number;
  hint?: React.ReactNode; tone?: "money" | "alert"; countUpCents?: number;
}) {
  const cents = useCountUp(countUpCents ?? 0);
  const shown = countUpCents != null ? money(Math.round(cents)) : value;
  return (
    <div className={`au-stat ${tone === "money" ? "au-stat-money" : ""} ${tone === "alert" ? "au-stat-alert" : ""}`}>
      <div className="au-stat-num" style={{ fontVariantNumeric: "tabular-nums" }}>
        {shown}{unit ? <span className="au-unit">{unit}</span> : null}
      </div>
      <div className="au-stat-base"><i style={{ ["--pct" as any]: `${Math.max(0, Math.min(100, pct))}%` }} /></div>
      <div className="au-stat-label">{label}</div>
      {hint ? <div className="au-kicker" style={{ fontSize: 12.5 }}>{hint}</div> : null}
    </div>
  );
}

/* ── useFlip: cards physically travel on reorder (the procession).
      Elements carry data-flip-id. capture() in the SAME tick as the state
      update that re-parents them. Reduced-motion bails. ── */
export function useFlip(deps: unknown[]) {
  const first = useRef<Map<string, DOMRect> | null>(null);
  const capture = () => {
    const m = new Map<string, DOMRect>();
    document.querySelectorAll<HTMLElement>("[data-flip-id]")
      .forEach((el) => m.set(el.dataset.flipId!, el.getBoundingClientRect()));
    first.current = m;
  };
  useLayoutEffect(() => {
    const prev = first.current;
    first.current = null;
    if (!prev || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const moves: { el: HTMLElement; dx: number; dy: number }[] = [];
    document.querySelectorAll<HTMLElement>("[data-flip-id]").forEach((el) => {
      const p = prev.get(el.dataset.flipId!);
      if (!p) return;
      const n = el.getBoundingClientRect();
      const dx = p.left - n.left, dy = p.top - n.top;
      if ((dx || dy) && Math.abs(dy) <= window.innerHeight) moves.push({ el, dx, dy });
    });
    for (const { el, dx, dy } of moves) {
      el.style.transition = "none";
      el.style.transform = `translate(${dx}px, ${dy}px)`;
      el.style.willChange = "transform";
      el.classList.add("au-flight");
    }
    requestAnimationFrame(() => requestAnimationFrame(() => {
      for (const { el } of moves) {
        el.style.transition = "transform .55s var(--au-ease)";
        el.style.transform = "";
        el.addEventListener("transitionend", function done() {
          el.style.transition = ""; el.style.willChange = "";
          el.classList.remove("au-flight");
          el.classList.add("au-land");
          setTimeout(() => el.classList.remove("au-land"), 600);
          el.removeEventListener("transitionend", done);
        }, { once: true });
      }
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return capture;
}

/* ── LedgerRow: the night-ledger / promises / board row ── */
export function LedgerRow({ tick = "gold", verb, obj, onUndo, right, struck }: {
  tick?: "gold" | "em" | "hollow"; verb: React.ReactNode; obj?: React.ReactNode;
  onUndo?: () => void; right?: React.ReactNode; struck?: boolean;
}) {
  return (
    <div className="au-lrow">
      <Tick em={tick === "em"} hollow={tick === "hollow"} />
      <span className="au-verb" style={struck ? { textDecoration: "line-through", color: "var(--ink3)" } : undefined}>{verb}</span>
      {obj != null && <span className="au-obj">{obj}</span>}
      {onUndo && <button className="au-undo" onClick={onUndo}>undo</button>}
      {right}
    </div>
  );
}
