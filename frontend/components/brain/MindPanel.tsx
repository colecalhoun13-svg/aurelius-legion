"use client";

// HOW I THINK + HOW HE SPEAKS TO YOU — the compiled lens and the persona
// ledger, surfaced (docs/REDESIGN_PLAN.md, Brain tab). The rules shelf lists
// confirmed + proposed heuristics with trust and fired counts; confirm/retire
// are ghost buttons that STAGE a Bridge ask (pattern.confirm/retire are
// neverGrant — only Cole's tap on Decisions fires them), and the toast says
// exactly that. The persona card is read-only by design: persona never
// auto-applies, and revoking happens by correcting him, not by a delete
// button here. Honest-empty on both shelves.

import React, { useCallback, useEffect, useState } from "react";
import { Btn, Divider, Panel, SectionLabel } from "../kit";

type MindRule = {
  id: string;
  rule: string;
  domain: string;
  status: "confirmed_heuristic" | "proposed_heuristic";
  trust: number;
  support: number;
  validated: number;
  ratified: number;
  fired: number;
};
type PersonaEntry = { key: string; value: string; updatedAt: string | null };

const annotation: React.CSSProperties = {
  fontFamily: "var(--font-data),Arial,sans-serif",
  fontWeight: 500,
  fontSize: 12.5,
  letterSpacing: ".06em",
  textTransform: "uppercase",
  color: "var(--ink3)",
};

export default function MindPanel() {
  const [rules, setRules] = useState<MindRule[] | null>(null);
  const [persona, setPersona] = useState<PersonaEntry[] | null>(null);
  const [factCount, setFactCount] = useState(0);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [staged, setStaged] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/brain/mind");
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error ?? `HTTP ${res.status}`);
      setRules(j.rules ?? []);
      setPersona(j.persona ?? []);
      setFactCount(j.factCount ?? 0);
      setErr("");
    } catch (e: any) {
      setErr(e?.message ?? "couldn't load the lens");
      setRules([]);
      setPersona([]);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  const stage = async (op: "confirm" | "retire", id: string) => {
    setBusy(`${op}:${id}`);
    try {
      const res = await fetch("/api/brain/mind", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ op, patternId: id }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error ?? `HTTP ${res.status}`);
      setStaged((s) => new Set(s).add(id));
      setToast(j.message ?? "Staged for your confirm on Decisions.");
    } catch (e: any) {
      setToast(e?.message ?? "Staging failed");
    } finally {
      setBusy(null);
    }
  };

  const confirmed = (rules ?? []).filter((r) => r.status === "confirmed_heuristic");
  const proposed = (rules ?? []).filter((r) => r.status === "proposed_heuristic");

  const ruleRow = (r: MindRule) => {
    const isConfirmed = r.status === "confirmed_heuristic";
    const isStaged = staged.has(r.id);
    return (
      <div key={r.id} className="flex items-baseline gap-4 py-3 px-1" style={{ borderBottom: "1px solid var(--line1)" }}>
        <div className="flex-1 min-w-0 space-y-1">
          <p
            className="m-0"
            style={{ fontFamily: "var(--font-body),Georgia,serif", fontStyle: "italic", fontWeight: 500, fontSize: "1.02rem", color: "var(--ink)" }}
          >
            &ldquo;{r.rule}&rdquo;
          </p>
          <div style={annotation}>
            <span style={isConfirmed ? { color: "var(--gold)" } : undefined}>{isConfirmed ? "confirmed" : "proposed"}</span>
            {" · "}trust {r.trust.toFixed(2)}
            {" · "}fired ×{r.fired}
            {r.ratified > 0 && <> · ratified ×{r.ratified}</>}
            {" · "}
            {r.domain.replace(/_/g, " ")}
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          {!isConfirmed && (
            <Btn ghost disabled={isStaged || busy === `confirm:${r.id}`} onClick={() => stage("confirm", r.id)}>
              {isStaged ? "staged" : "confirm"}
            </Btn>
          )}
          <Btn ghost disabled={isStaged || busy === `retire:${r.id}`} onClick={() => stage("retire", r.id)}>
            {isStaged ? "staged" : "retire"}
          </Btn>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8 aurelius-reveal" style={{ color: "var(--ink)" }}>
      {/* ── the rules shelf ── */}
      <header className="flex items-baseline justify-between gap-3 flex-wrap">
        <SectionLabel row>How I think</SectionLabel>
        <span style={annotation}>
          {rules === null ? "…" : `${confirmed.length} confirmed · ${proposed.length} proposed${factCount > 0 ? ` · ${factCount} compiled facts` : ""}`}
        </span>
      </header>
      <p className="au-kicker" style={{ display: "block", fontSize: 14, marginTop: "-1rem" }}>
        confirmed rules ground every answer; proposed ones steer nothing until your hand. Confirm or retire here
        stages the ask — the change itself fires only on your tap, on Decisions.
      </p>

      {err && <p className="text-sm" style={{ color: "var(--danger)" }}>Couldn&apos;t load: {err}</p>}
      {toast && (
        <p className="au-kicker" style={{ display: "block", color: "var(--gold)", fontSize: 14 }} role="status">
          {toast}
        </p>
      )}

      {rules !== null && rules.length === 0 && !err && (
        <p className="au-kicker text-center" style={{ display: "block" }}>
          no confirmed rules yet — they arrive as you correct him.
        </p>
      )}
      {rules !== null && rules.length > 0 && <div>{[...confirmed, ...proposed].map(ruleRow)}</div>}

      <Divider />

      {/* ── the persona ledger — read-only, persona never auto-applies ── */}
      <Panel
        tier="card"
        label="How he speaks to you"
        headerRight={
          <span style={annotation}>
            {persona === null ? "…" : `${persona.length} learned calibration${persona.length === 1 ? "" : "s"} — each yours to revoke`}
          </span>
        }
      >
        {persona !== null && persona.length === 0 && (
          <p className="au-kicker" style={{ display: "block" }}>
            no calibrations yet — the Sunday observer proposes them from how you actually talk, and none applies
            without your confirm.
          </p>
        )}
        {persona !== null && persona.length > 0 && (
          <div>
            {persona.map((e) => (
              <div key={e.key} className="flex items-baseline gap-3 py-2 px-1" style={{ borderBottom: "1px solid var(--line1)" }}>
                <span className="shrink-0" style={{ ...annotation, color: "var(--gold-dim)" }}>
                  {e.key.replace(/_/g, " ")}
                </span>
                <span className="flex-1 min-w-0 text-sm" style={{ color: "var(--ink2)" }}>
                  {e.value}
                </span>
              </div>
            ))}
          </div>
        )}
        <p className="au-kicker" style={{ display: "block", marginTop: ".8rem", fontSize: 13.5 }}>
          revoke by telling him he&apos;s wrong — the observer proposes, you ratify. Nothing here ever applied itself.
        </p>
      </Panel>
    </div>
  );
}
