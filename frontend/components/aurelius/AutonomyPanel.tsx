"use client";

// THE AUTONOMY DIAL — the throttle the whole vision turns on. Cole can SEE which
// keyholes are open, the track record behind each ("acted 24×, 0 undos"), the
// "want me to just handle it?" suggestions, and reverse anything Aurelius did on
// its own. Granting/revoking here is Cole's own hand on the switch.
//
// ELEVATED IMPERIAL re-dress: same /api/autonomy/dial + /api/autonomy/undo
// calls, same grant/revoke/undo handlers — keyholes render as au-kh rows with
// au-sw switches. The outward levers (publish · send · spend) render LOCKED:
// the dial API only lists grantable classes because no dial for outward
// exists — non-grantable by construction, so the row is carved in statically.

import { useCallback, useEffect, useState } from "react";
import { SparkBars } from "../viz/Spark";
import { Btn, Panel, SectionLabel } from "../kit";

type TrackRecord = { acted: number; confirmed: number; undone: number; failed: number };
type Keyhole = { key: string; description: string; on: boolean; trackRecord: TrackRecord | null };
type Suggestion = { actionClass: string; reason: string };
type RecentAction = { id: string; title: string; kind: string; createdAt: string; actionClass: string | null };
type FlowSignal = { status: "acted" | "confirmed" | "undone"; createdAt: string };
type Dial = { active: { actionClass: string; grantedAt: string }[]; classes: Keyhole[]; suggestions: Suggestion[]; recentActions: RecentAction[]; flow?: FlowSignal[] };

// TRUST BAR (final council graphic): a keyhole's record as a shape, not
// arithmetic. Gold = trusted-and-held (acted + confirmed), amber = Cole
// reversed it, terracotta = it failed. An unbroken gold bar is a visceral
// "widen it"; any amber segment is a visible scar.
function TrustBar({ t }: { t: TrackRecord }) {
  const total = t.acted + t.confirmed + t.undone + t.failed;
  if (total === 0) return null;
  const pct = (n: number) => `${(n / total) * 100}%`;
  return (
    <span className="flex items-center gap-2 mt-1.5">
      <span className="flex h-1.5 rounded-full overflow-hidden flex-1 max-w-[220px]" style={{ background: "var(--line1)" }}>
        <span style={{ width: pct(t.acted + t.confirmed), background: "linear-gradient(90deg,var(--gold-dim),var(--gold))" }} />
        <span style={{ width: pct(t.undone), background: "var(--attn)" }} />
        <span style={{ width: pct(t.failed), background: "var(--danger)" }} />
      </span>
      <span className="text-[10px] shrink-0" style={{ color: "var(--ink3)", fontVariantNumeric: "tabular-nums" }}>{total}×</span>
    </span>
  );
}

function localDayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function AutonomyPanel() {
  const [dial, setDial] = useState<Dial | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  // Undo horizon: a week by default, widened on demand — the server can
  // reverse older actions just fine, the list only shows what's asked for.
  const [days, setDays] = useState(7);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/autonomy/dial?days=${days}`);
      if (!res.ok) throw new Error("Aurelius couldn't load this right now — try again in a moment.");
      setDial(await res.json());
    } catch (e: any) {
      setErr(e?.message ?? "failed to load");
    }
  }, [days]);
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
    <div className="max-w-3xl mx-auto space-y-8 aurelius-reveal">
      <div>
        <div className="flex items-baseline justify-between gap-4 flex-wrap">
          <SectionLabel row>The keyholes — what he may finish on his own</SectionLabel>
          <span className="au-kicker" style={{ fontSize: 13.5 }}>
            {dial === null ? "…" : onCount ? `${onCount} keyhole${onCount === 1 ? "" : "s"} open` : "acts on nothing"}
          </span>
        </div>
        <p className="au-kicker mt-2" style={{ display: "block", fontSize: 13.5 }}>
          each switch lets Aurelius finalize an inward action on its own — reversibly, always landing on the
          Bridge. Outward actions (send · publish · spend) can never be granted. The switch is only ever your hand.
        </p>
      </div>

      {err && <p className="text-sm" style={{ color: "var(--danger)" }}>Couldn't load: {err}</p>}

      {/* THE KEYHOLES — the dial itself */}
      <div>
        {(dial?.classes ?? []).map((c) => (
          <div key={c.key} className="au-kh flex-wrap">
            <span className="au-kn">{c.description || c.key}</span>
            <span className="au-kd min-w-[180px]">
              <span style={{ color: "var(--gold-dim)", fontStyle: "normal", fontSize: 12 }}>{c.key}</span>
              {c.trackRecord && (c.trackRecord.acted + c.trackRecord.confirmed + c.trackRecord.undone + c.trackRecord.failed) > 0 && (
                <>
                  <span className="block" style={{ fontSize: 12.5 }}>
                    acted {c.trackRecord.acted} · confirmed {c.trackRecord.confirmed}
                    {c.trackRecord.undone > 0 && <span style={{ color: "var(--attn)" }}> · undone {c.trackRecord.undone}</span>}
                    {c.trackRecord.failed > 0 && <span style={{ color: "var(--danger)" }}> · failed {c.trackRecord.failed}</span>}
                  </span>
                  <TrustBar t={c.trackRecord} />
                </>
              )}
            </span>
            <button
              type="button"
              className={`au-sw ${c.on ? "on" : ""}`}
              style={{ padding: 0 }}
              role="switch"
              aria-checked={c.on}
              aria-label={`${c.on ? "Revoke" : "Grant"} ${c.description || c.key}`}
              title={busy === c.key ? "…" : c.on ? "granted — tap to revoke" : "tap to grant"}
              disabled={busy === c.key}
              onClick={() => act(c.on ? "revoke" : "grant", c.key)}
            />
          </div>
        ))}

        {/* The outward levers — no dial exists. The dial API lists only
            grantable (inward) classes; publish/send/spend are non-grantable
            by construction, so this row is architecture, not data. */}
        <div className="au-kh flex-wrap">
          <span className="au-kn">Publish · Send · Spend</span>
          <span className="au-kd min-w-[180px]" style={{ color: "var(--gold)" }}>
            no dial exists — outward is non-grantable by construction; every instance asks
          </span>
          <div className="au-sw lock" title="non-grantable by construction" aria-disabled="true" />
        </div>

        <p className="au-kicker mt-3" style={{ display: "block" }}>
          trust is earned upward: when a keyhole runs clean for weeks, he suggests the next — never flips it himself
        </p>
      </div>

      {/* Suggestions — earned trust, offered */}
      {dial?.suggestions && dial.suggestions.length > 0 && (
        <div className="space-y-3">
          <SectionLabel row gold>Worth handing over</SectionLabel>
          {dial.suggestions.map((s) => (
            <div key={s.actionClass} className="au-card p-4 flex items-start justify-between gap-3" style={{ borderColor: "var(--gold-line)" }}>
              <span className="text-sm" style={{ color: "var(--ink)" }}>{s.reason}</span>
              <Btn
                onClick={() => act("grant", s.actionClass)}
                disabled={busy === s.actionClass}
                className="shrink-0"
              >
                {busy === s.actionClass ? "…" : "Grant it"}
              </Btn>
            </div>
          ))}
        </div>
      )}

      {/* The fortnight's flow — how much got done without Cole's hand, per day */}
      {(() => {
        const flow = dial?.flow ?? [];
        if (flow.length === 0) return null;
        // Calendar-stepped, not 86400s arithmetic — DST fall-back would
        // duplicate a key (duplicate React keys, one missing bar).
        const flowDays = Array.from({ length: 14 }, (_, i) => {
          const d = new Date();
          d.setDate(d.getDate() - (13 - i));
          return { key: localDayKey(d), label: "SMTWTFS"[d.getDay()]! };
        });
        const byDay = new Map(flowDays.map((d) => [d.key, 0]));
        let undone = 0;
        for (const s of flow) {
          if (s.status === "undone") { undone++; continue; }
          const k = localDayKey(new Date(s.createdAt));
          if (byDay.has(k)) byDay.set(k, (byDay.get(k) ?? 0) + 1);
        }
        return (
          <Panel
            tier="card"
            label="Work handled, fourteen days"
            headerRight={
              <span className="au-kicker" style={{ fontSize: 12.5, color: undone > 0 ? "var(--attn)" : undefined }}>
                {undone > 0 ? `${undone} undone` : "nothing undone"}
              </span>
            }
          >
            <div className="overflow-x-auto">
              <SparkBars values={flowDays.map((d) => byDay.get(d.key) ?? 0)} labels={flowDays.map((d) => d.label)} width={520} height={64} />
            </div>
          </Panel>
        );
      })()}

      {/* Recent autonomous actions — reversible */}
      {dial?.recentActions && dial.recentActions.length > 0 && (
        <div>
          <div className="flex items-baseline justify-between gap-4 flex-wrap">
            <SectionLabel row>Recent actions — reversible</SectionLabel>
            <button
              onClick={() => setDays(days === 7 ? 90 : 7)}
              className="au-kicker"
              style={{ background: "none", border: 0, cursor: "pointer", fontSize: 12.5 }}
            >
              {days === 7 ? "show older ↓" : "last 7 days ↑"}
            </button>
          </div>
          <div className="mt-1">
            {dial.recentActions.map((a) => (
              <div key={a.id} className="au-lrow">
                <span className="au-verb min-w-0 truncate">{a.title}</span>
                <span className="au-obj shrink-0" style={{ fontSize: 12.5 }}>
                  {a.actionClass ?? a.kind} · {new Date(a.createdAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </span>
                <button className="au-undo" onClick={() => undo(a.id)} disabled={busy === a.id}>
                  {busy === a.id ? "undoing…" : "undo"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
