"use client";

// THE AUTONOMY DIAL — the throttle the whole vision turns on. Cole can SEE which
// keyholes are open, the track record behind each ("acted 24×, 0 undos"), the
// "want me to just handle it?" suggestions, and reverse anything Aurelius did on
// its own. Granting/revoking here is Cole's own hand on the switch.

import { useCallback, useEffect, useState } from "react";

type TrackRecord = { acted: number; confirmed: number; undone: number; failed: number };
type Keyhole = { key: string; description: string; on: boolean; trackRecord: TrackRecord | null };
type Suggestion = { actionClass: string; reason: string };
type RecentAction = { id: string; title: string; kind: string; createdAt: string; actionClass: string | null };
type Dial = { active: { actionClass: string; grantedAt: string }[]; classes: Keyhole[]; suggestions: Suggestion[]; recentActions: RecentAction[] };

export default function AutonomyPage() {
  const [dial, setDial] = useState<Dial | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/autonomy/dial");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setDial(await res.json());
    } catch (e: any) {
      setErr(e?.message ?? "failed to load");
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const act = useCallback(async (op: "grant" | "revoke", actionClass: string) => {
    if (busy) return;
    setBusy(actionClass);
    try {
      const res = await fetch("/api/autonomy/dial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ op, actionClass }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        window.alert(`Couldn't ${op}: ${j.error ?? res.status}`);
      }
      await load();
    } finally {
      setBusy(null);
    }
  }, [busy, load]);

  const undo = useCallback(async (id: string) => {
    if (busy) return;
    setBusy(id);
    try {
      const res = await fetch("/api/autonomy/undo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signalId: id }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        window.alert(`Couldn't undo: ${j.error ?? res.status}`);
      }
      await load();
    } finally {
      setBusy(null);
    }
  }, [busy, load]);

  const onCount = dial?.classes.filter((c) => c.on).length ?? 0;

  return (
    <main className="text-aurelius-text max-w-3xl mx-auto space-y-6 aurelius-stagger">
      <header className="flex items-baseline justify-between aurelius-rule">
        <h1 className="aurelius-heading text-4xl">Autonomy</h1>
        <span className="text-sm text-neutral-500">
          {dial === null ? "…" : onCount ? `${onCount} keyhole${onCount === 1 ? "" : "s"} open` : "acts on nothing"}
        </span>
      </header>

      <p className="text-sm text-neutral-500">
        The keyholes that let Aurelius finalize an inward action on its own — reversibly, always landing on the Bridge.
        Outward actions (send/publish/spend) can never be granted. The switch is only ever your hand.
      </p>

      {err && <p className="text-red-400 text-sm">Couldn't load: {err}</p>}

      {/* Suggestions — earned trust, offered */}
      {dial?.suggestions && dial.suggestions.length > 0 && (
        <section className="space-y-3">
          <h2 className="aurelius-heading text-lg text-aurelius-gold/80">Worth handing over</h2>
          {dial.suggestions.map((s) => (
            <div key={s.actionClass} className="aurelius-panel-frame p-4 border border-emerald-400/40 flex items-start justify-between gap-3">
              <span className="text-sm text-neutral-200">{s.reason}</span>
              <button
                onClick={() => act("grant", s.actionClass)}
                disabled={busy === s.actionClass}
                className="text-sm border border-emerald-500/60 rounded-lg px-4 py-1 hover:bg-emerald-500/20 text-emerald-300 font-medium disabled:opacity-50 shrink-0"
              >
                {busy === s.actionClass ? "…" : "Grant it"}
              </button>
            </div>
          ))}
        </section>
      )}

      {/* The keyholes */}
      <section className="space-y-3">
        <h2 className="aurelius-heading text-lg">The keyholes</h2>
        {(dial?.classes ?? []).map((c) => {
          const t = c.trackRecord;
          return (
            <div key={c.key} className={`aurelius-panel-frame p-4 border ${c.on ? "border-aurelius-gold/50" : "border-neutral-700/60"}`}>
              <div className="flex items-start justify-between gap-3">
                <span className="min-w-0">
                  <span className="font-medium text-sm">
                    <span className="text-aurelius-gold">{c.key}</span>
                    {c.on && <span className="ml-2 text-[10px] uppercase tracking-wider text-emerald-400 border border-emerald-500/40 rounded px-1.5 py-0.5">on</span>}
                  </span>
                  {c.description && <span className="block text-xs text-neutral-500 mt-1">{c.description}</span>}
                  {t && (t.acted + t.confirmed + t.undone + t.failed) > 0 && (
                    <span className="block text-[11px] text-neutral-600 mt-1.5">
                      acted {t.acted} · confirmed {t.confirmed}
                      {t.undone > 0 && <span className="text-amber-400/80"> · undone {t.undone}</span>}
                      {t.failed > 0 && <span className="text-red-400/80"> · failed {t.failed}</span>}
                    </span>
                  )}
                </span>
                <button
                  onClick={() => act(c.on ? "revoke" : "grant", c.key)}
                  disabled={busy === c.key}
                  className={`text-sm rounded-lg px-4 py-1 shrink-0 disabled:opacity-50 border ${
                    c.on
                      ? "border-neutral-600 hover:bg-neutral-800 text-neutral-300"
                      : "border-aurelius-gold/50 hover:bg-aurelius-gold/15 text-aurelius-gold"
                  }`}
                >
                  {busy === c.key ? "…" : c.on ? "Revoke" : "Grant"}
                </button>
              </div>
            </div>
          );
        })}
      </section>

      {/* Recent autonomous actions — reversible */}
      {dial?.recentActions && dial.recentActions.length > 0 && (
        <section className="space-y-3">
          <h2 className="aurelius-heading text-lg">Recent actions — reversible</h2>
          {dial.recentActions.map((a) => (
            <div key={a.id} className="aurelius-panel-frame p-4 border border-aurelius-gold/20 flex items-start justify-between gap-3">
              <span className="min-w-0">
                <span className="block text-sm text-neutral-200 truncate">{a.title}</span>
                <span className="block text-[11px] text-neutral-600 mt-0.5">
                  {a.actionClass ?? a.kind} · {new Date(a.createdAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </span>
              </span>
              <button
                onClick={() => undo(a.id)}
                disabled={busy === a.id}
                className="text-sm border border-amber-500/50 rounded-lg px-4 py-1 hover:bg-amber-500/15 text-amber-300 disabled:opacity-50 shrink-0"
              >
                {busy === a.id ? "Undoing…" : "Undo"}
              </button>
            </div>
          ))}
        </section>
      )}
    </main>
  );
}
