"use client";

// THE DOOR — chromeless by design (outside the (chrome) group). One field,
// once per device; the cookie holds for a year. Imperial, spare, honest.

import { useState } from "react";

export default function UnlockPage() {
  const [key, setKey] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!key.trim() || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: key.trim() }),
      });
      if (res.ok) {
        window.location.href = "/home";
      } else {
        const j = await res.json().catch(() => ({}));
        setErr(j.error ?? "that's not the key");
      }
    } catch {
      setErr("couldn't reach the door — try again");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-black flex items-center justify-center px-6">
      <div className="w-full max-w-sm text-center border border-aurelius-gold/40 rounded-xl px-8 py-12 space-y-6">
        <div>
          <div className="aurelius-heading text-3xl tracking-[0.25em] text-aurelius-gold">AURELIUS</div>
          <p className="mt-2 text-sm text-neutral-500">This mind answers to one operator.</p>
        </div>
        <input
          type="password"
          autoFocus
          value={key}
          onChange={(e) => setKey(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="unlock key"
          className="w-full bg-black/60 border border-aurelius-gold/30 rounded-lg px-4 py-3 text-center text-aurelius-text outline-none focus:border-aurelius-gold/70"
        />
        {err && <p className="text-sm text-red-400">{err}</p>}
        <button
          onClick={submit}
          disabled={busy || !key.trim()}
          className="w-full py-3 bg-aurelius-gold text-black font-semibold rounded-lg disabled:opacity-40"
        >
          {busy ? "…" : "Enter"}
        </button>
        <p className="text-[11px] text-neutral-600">One entry per device — the door stays open a year.</p>
      </div>
    </main>
  );
}
