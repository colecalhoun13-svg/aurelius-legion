"use client";

// THE STANDARD — the public assessment funnel.
//
// Cole's proven hook is a dichotomy that names the reader's mistake: training
// for aesthetics is not training like an athlete. This page turns that into a
// two-minute self-assessment. The athlete enters a few honest numbers and is
// told, plainly, where they stand against the athletic standard. The verdict is
// the value; the email is the ask, and it comes AFTER the value, never before.
//
// Public by construction (middleware exempts it), outside the app chrome, and
// it promises nothing on Cole's behalf — he sets standards, he doesn't sell
// guarantees, and a landing page is exactly where that line slips.

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

type Band = "below" | "approaching" | "at" | "above";
type StandardResult = {
  sport: string;
  overall: Band;
  headline: string;
  metrics: Array<{ label: string; value: string; band: Band; line: string }>;
  cta: string;
};

const BAND_COLOR: Record<Band, string> = {
  below: "text-red-300 border-red-400/40",
  approaching: "text-amber-300 border-amber-400/40",
  at: "text-emerald-300 border-emerald-400/40",
  above: "text-aurelius-gold border-aurelius-gold/50",
};

function StandardForm() {
  const params = useSearchParams();
  const ref = params.get("ref") ?? undefined;

  const [sport, setSport] = useState("");
  const [bodyweightLbs, setBw] = useState("");
  const [squatLbs, setSquat] = useState("");
  const [verticalInches, setVert] = useState("");
  const [gradYear, setGrad] = useState("");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  const [result, setResult] = useState<StandardResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [captured, setCaptured] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const field =
    "w-full bg-black/50 border border-aurelius-gold/30 rounded px-3 py-2.5 text-base text-aurelius-text placeholder:text-aurelius-text/30";

  async function call(withEmail: boolean) {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/standard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sport: sport.trim() || undefined,
          bodyweightLbs, squatLbs, verticalInches, gradYear,
          ref,
          ...(withEmail ? { name: name.trim(), email: email.trim() } : {}),
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error ?? "Something went wrong.");
      setResult(j.result);
      if (j.captured) setCaptured(true);
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  const hasNumbers = !!(bodyweightLbs || squatLbs || verticalInches);

  return (
    <div className="space-y-5">
      {/* The numbers */}
      <form onSubmit={(e) => { e.preventDefault(); call(false); }} className="space-y-3">
        <input value={sport} onChange={(e) => setSport(e.target.value)} placeholder="Sport (e.g. basketball, football)" className={field} />
        <div className="grid grid-cols-2 gap-3">
          <input value={bodyweightLbs} onChange={(e) => setBw(e.target.value)} placeholder="Bodyweight (lbs)" inputMode="decimal" className={field} />
          <input value={squatLbs} onChange={(e) => setSquat(e.target.value)} placeholder="Best squat (lbs)" inputMode="decimal" className={field} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <input value={verticalInches} onChange={(e) => setVert(e.target.value)} placeholder='Vertical (in)' inputMode="decimal" className={field} />
          <input value={gradYear} onChange={(e) => setGrad(e.target.value)} placeholder="Class / grad year" inputMode="numeric" className={field} />
        </div>
        {err && <div className="rounded border border-red-500/40 bg-red-950/20 p-3 text-sm text-red-200">{err}</div>}
        <button
          type="submit"
          disabled={busy || !hasNumbers}
          className="w-full py-3 rounded border border-aurelius-gold/50 text-aurelius-gold hover:bg-aurelius-gold/10 disabled:opacity-40 aurelius-heading tracking-wide"
        >
          {busy ? "Checking…" : "See where you stand"}
        </button>
      </form>

      {/* The verdict */}
      {result && (
        <div className="space-y-4 aurelius-stagger">
          <div className={`rounded border p-4 ${BAND_COLOR[result.overall]}`}>
            <p className="text-base leading-relaxed">{result.headline}</p>
          </div>
          {result.metrics.length > 0 && (
            <ul className="space-y-2">
              {result.metrics.map((m) => (
                <li key={m.label} className={`rounded border p-3 ${BAND_COLOR[m.band]}`}>
                  <div className="flex justify-between items-baseline">
                    <span className="text-xs uppercase tracking-wider opacity-70">{m.label}</span>
                    <span className="text-lg font-semibold">{m.value}</span>
                  </div>
                  <p className="text-sm text-aurelius-text/80 mt-1">{m.line}</p>
                </li>
              ))}
            </ul>
          )}
          <p className="text-[11px] text-aurelius-text/40">
            These are standard bands, not a guarantee — and a starting read, not a diagnosis. The point is the gap and the work.
          </p>

          {/* The gated ask — value first, email second */}
          {captured ? (
            <div className="rounded border border-emerald-500/40 bg-emerald-950/20 p-5">
              <h2 className="aurelius-heading text-emerald-300 text-lg mb-2">Locked in.</h2>
              <p className="text-aurelius-text/80 leading-relaxed">
                Cole will come back to you personally with the full breakdown — a real reply from him, not an autoresponder.
              </p>
            </div>
          ) : (
            <form onSubmit={(e) => { e.preventDefault(); call(true); }} className="space-y-3 border-t border-aurelius-gold/15 pt-4">
              <p className="text-sm text-aurelius-text/70">{result.cta}</p>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" required className={field} autoComplete="name" />
              <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" type="email" required className={field} autoComplete="email" />
              <button
                type="submit"
                disabled={busy || !name.trim() || !email.trim()}
                className="w-full py-3 rounded border border-aurelius-gold/50 text-aurelius-gold hover:bg-aurelius-gold/10 disabled:opacity-40"
              >
                {busy ? "Sending…" : "Get the full breakdown from Cole"}
              </button>
              <p className="text-[11px] text-aurelius-text/40 text-center">Goes straight to Cole. No list, no sequence, no spam.</p>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

export default function StandardPage() {
  return (
    <div className="min-h-screen bg-aurelius-bg px-5 py-12">
      <div className="max-w-md mx-auto space-y-6">
        <header>
          <h1 className="aurelius-heading text-2xl text-aurelius-gold">The Standard</h1>
          <p className="text-sm text-aurelius-text/60 mt-2 leading-relaxed">
            Move fast, lift heavy, be an athlete. Most training builds a gym number, not an athletic one. Enter a
            few honest numbers and see where you actually stand — in two minutes, no email required to find out.
          </p>
        </header>
        <Suspense fallback={<div className="text-aurelius-text/40">Loading…</div>}>
          <StandardForm />
        </Suspense>
        <p className="text-[11px] text-aurelius-text/40 text-center">
          Just want to reach Cole? <a href="/start" className="text-aurelius-gold/60 hover:text-aurelius-gold underline">Message him here</a>.
        </p>
      </div>
    </div>
  );
}
