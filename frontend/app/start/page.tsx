"use client";

// THE FRONT DOOR.
//
// /intake existed as a JSON POST endpoint, which meant the funnel's first step
// was reachable by curl and by nobody else. A prospect who reads Cole's post
// had nowhere to land. This is that page: public, outside the app lock,
// outside the chrome, and deliberately the shortest form that still produces a
// lead worth following up.
//
// It carries `?ref=` from the link in the post, which is how the angle that
// earned the lead gets credit — otherwise Cole's own results can never outrank
// generic research, because nothing would connect a stranger to an idea.
//
// It promises nothing on Cole's behalf. He is a standard-setter, not a
// guarantee coach, and a landing page is exactly where that slips.

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function StartForm() {
  const params = useSearchParams();
  const ref = params.get("ref") ?? undefined;

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [sport, setSport] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim() || undefined,
          sport: sport.trim() || undefined,
          message: message.trim() || undefined,
          ref,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error ?? "Something went wrong.");
      setDone(true);
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  const field =
    "w-full bg-black/50 border border-aurelius-gold/30 rounded px-3 py-2.5 text-base text-aurelius-text placeholder:text-aurelius-text/30";

  if (done) {
    return (
      <div className="rounded border border-emerald-500/40 bg-emerald-950/20 p-5">
        <h2 className="aurelius-heading text-emerald-300 text-lg mb-2">Got it.</h2>
        <p className="text-aurelius-text/80 leading-relaxed">
          Cole will come back to you personally — a real reply from him, not an autoresponder.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" required className={field} autoComplete="name" />
      <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" type="email" className={field} autoComplete="email" />
      <input value={sport} onChange={(e) => setSport(e.target.value)} placeholder="Sport (optional)" className={field} />
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={4}
        placeholder="What are you working toward? Anything you've been stuck on?"
        className={field}
      />
      {err && <div className="rounded border border-red-500/40 bg-red-950/20 p-3 text-sm text-red-200">{err}</div>}
      <button
        type="submit"
        disabled={busy || !name.trim()}
        className="w-full py-3 rounded border border-aurelius-gold/50 text-aurelius-gold hover:bg-aurelius-gold/10 disabled:opacity-40"
      >
        {busy ? "Sending…" : "Send it to Cole"}
      </button>
      <p className="text-[11px] text-aurelius-text/40 text-center">
        Goes straight to Cole. No list, no sequence, no spam.
      </p>
    </form>
  );
}

export default function StartPage() {
  return (
    <div className="min-h-screen bg-aurelius-bg px-5 py-12">
      <div className="max-w-md mx-auto space-y-6">
        <header>
          <h1 className="aurelius-heading text-2xl text-aurelius-gold">Work with Cole</h1>
          <p className="text-sm text-aurelius-text/60 mt-2 leading-relaxed">
            Remote strength coaching for athletes who want to understand their own bodies, not just follow a
            program. Tell him where you are and what you&apos;re chasing.
          </p>
        </header>
        {/* useSearchParams needs a Suspense boundary to prerender. */}
        <Suspense fallback={<div className="text-aurelius-text/40">Loading…</div>}>
          <StartForm />
        </Suspense>
      </div>
    </div>
  );
}
