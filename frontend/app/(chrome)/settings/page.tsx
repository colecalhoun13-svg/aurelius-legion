"use client";

// SETTINGS — real, finally. One truth source: the backend's integration
// registry (status derived from live state, never hardcoded). Gold means
// working now; anything else says exactly what unlocks it — hard rule 4
// ("dormant until configured") made visible, with one-click connects for
// the OAuth flows.
//
// ELEVATED IMPERIAL parity re-dress: same fetches, same controls, Machine
// styling. Quiet mode is an HONEST placeholder — the verb ships with the
// next backend wave, so the control is disabled and says so (no dead call).

import { useEffect, useState } from "react";
import { backendUrl } from "../../../lib/backendUrl";
import { Btn, SectionLabel } from "../../../components/kit";

type Integration = {
  name: string;
  status: "live" | "partial" | "config" | "deploy" | "planned" | "parked";
  desc: string;
  glyph: string;
  need?: string;
};

const LIGHT: Record<Integration["status"], { dot: React.CSSProperties; label: string }> = {
  live: { dot: { background: "var(--gold)", boxShadow: "0 0 6px rgba(212,175,55,.4)" }, label: "live" },
  partial: { dot: { background: "var(--gold-dim)" }, label: "partial" },
  config: { dot: { background: "none", border: "1px solid var(--attn)" }, label: "needs a key" },
  deploy: { dot: { background: "none", border: "1px solid var(--ink3)" }, label: "wakes at the Mini" },
  planned: { dot: { background: "none", border: "1px solid var(--ink3)" }, label: "not built yet" },
  parked: { dot: { background: "none", border: "1px solid var(--line2)" }, label: "parked" },
};

const CONNECTS: Array<{ name: string; path: string; desc: string }> = [
  { name: "Google (Calendar · Sheets · Drive)", path: "/api/calendar/auth", desc: "one authorization covers all three" },
  { name: "Gmail", path: "/api/gmail/auth", desc: "read + draft-only, never sends alone" },
  { name: "Instagram", path: "/api/instagram/auth", desc: "metrics + gated publishing" },
];

export default function SettingsPage() {
  const [items, setItems] = useState<Integration[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  // ── Quiet mode (the verb landed with the completeness wave) ──
  const [quiet, setQuiet] = useState<{ active: boolean; until: string | null; reason: string | null } | null>(null);
  const [quietDays, setQuietDays] = useState("3");
  const [quietReason, setQuietReason] = useState("");
  const [quietBusy, setQuietBusy] = useState(false);
  const [quietMsg, setQuietMsg] = useState<string | null>(null);

  const loadQuiet = () =>
    fetch("/api/promises")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j?.quiet && setQuiet(j.quiet))
      .catch(() => {});
  useEffect(() => {
    loadQuiet();
  }, []);

  const goQuiet = async () => {
    const days = Number(quietDays);
    if (!Number.isFinite(days) || days <= 0) {
      setQuietMsg("How many days? A positive number.");
      return;
    }
    setQuietBusy(true);
    setQuietMsg(null);
    try {
      const res = await fetch("/api/promises", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ op: "quiet", days, reason: quietReason.trim() || "away" }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setQuietMsg(`Couldn't set quiet: ${j.error ?? "try again in a moment"}`);
      } else {
        setQuietMsg(
          `Quiet until ${String(j.until ?? "").slice(0, 10)} — rituals holding, ${j.leadsShifted ?? 0} follow-up${(j.leadsShifted ?? 0) === 1 ? "" : "s"} shifted. It ends itself.`
        );
        await loadQuiet();
      }
    } catch {
      setQuietMsg("Couldn't reach the brain — quiet was not set.");
    } finally {
      setQuietBusy(false);
    }
  };

  const endQuiet = async () => {
    setQuietBusy(true);
    setQuietMsg(null);
    try {
      const res = await fetch("/api/promises", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ op: "quiet_end" }),
      });
      const j = await res.json().catch(() => ({}));
      setQuietMsg(res.ok ? (j.summary ? `Back. ${j.summary}` : "Back — rituals resume.") : `Couldn't end quiet: ${j.error ?? "try again"}`);
      await loadQuiet();
    } catch {
      setQuietMsg("Couldn't reach the brain.");
    } finally {
      setQuietBusy(false);
    }
  };
  // Resolved on the client so Connect works from the phone PWA too
  // (Codespaces forwarded domains derive the backend from the page's host).
  const [backend, setBackend] = useState("http://localhost:3001");
  // The one honest light for "is the always-on backend actually up?" —
  // /health is auth-exempt and instant (pre-flight: nothing showed this).
  const [backendUp, setBackendUp] = useState<boolean | null>(null);
  useEffect(() => {
    const b = backendUrl();
    setBackend(b);
    fetch(`${b}/health`, { mode: "cors" })
      .then((r) => setBackendUp(r.ok))
      .catch(() => setBackendUp(false));
  }, []);

  useEffect(() => {
    fetch("/api/tools")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("unreachable"))))
      .then((j) => setItems(j.integrations ?? []))
      .catch(() => setErr("Aurelius couldn't load integration status — try again in a moment."));
  }, []);

  const sorted = (items ?? []).slice().sort((a, b) => {
    const order = ["live", "partial", "config", "deploy", "planned", "parked"];
    return order.indexOf(a.status) - order.indexOf(b.status);
  });

  return (
    <div className="au-horizon">
      <div className="max-w-2xl mx-auto pb-12 relative z-[1] space-y-10">
        <header className="text-center pt-2">
          <h1 className="au-title" style={{ fontSize: "clamp(2rem,5vw,2.6rem)", lineHeight: 1.1, margin: 0 }}>
            Settings
          </h1>
          <p className="au-kicker mt-2 flex items-center justify-center gap-2" style={{ fontSize: 13.5 }}>
            <span
              className="w-2 h-2 rounded-full inline-block"
              style={
                backendUp === null
                  ? { background: "var(--ink3)" }
                  : backendUp
                    ? { background: "var(--gold)", boxShadow: "0 0 6px rgba(212,175,55,.4)" }
                    : { background: "var(--danger)" }
              }
            />
            {backendUp === null ? "checking backend…" : backendUp ? "backend connected" : "backend unreachable"}
          </p>
        </header>

        <section className="space-y-3">
          <SectionLabel>One-click connects</SectionLabel>
          <div className="space-y-2">
            {CONNECTS.map((c) => (
              <a
                key={c.name}
                href={`${backend}${c.path}`}
                className="au-card flex items-center gap-4 px-4 py-3"
              >
                <span className="flex-1 min-w-0">
                  <span
                    className="block text-sm uppercase"
                    style={{ fontFamily: "var(--font-body),Georgia,serif", fontWeight: 600, letterSpacing: ".1em", color: "var(--ink2)" }}
                  >
                    {c.name}
                  </span>
                  <span className="au-kicker block" style={{ fontSize: 12.5 }}>{c.desc}</span>
                </span>
                <span
                  className="text-xs uppercase shrink-0 rounded-[2px] px-3 py-1.5"
                  style={{
                    fontFamily: "var(--font-body),Georgia,serif", fontWeight: 600, letterSpacing: ".16em",
                    color: "var(--gold)", border: "1px solid var(--gold-line)",
                  }}
                >
                  Connect
                </span>
              </a>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <SectionLabel>The household</SectionLabel>
          {quiet?.active ? (
            <div className="text-center space-y-2">
              <p className="text-sm" style={{ color: "var(--gold)" }}>
                Quiet until {String(quiet.until ?? "").slice(0, 10)}
                {quiet.reason ? ` — ${quiet.reason}` : ""}
              </p>
              <p className="au-kicker" style={{ display: "block", fontSize: 12.5 }}>
                briefing, midday check, debrief and outreach sweep are holding; it ends itself
              </p>
              <Btn ghost onClick={endQuiet} disabled={quietBusy}>
                {quietBusy ? "…" : "I'm back — end quiet now"}
              </Btn>
            </div>
          ) : (
            <div className="text-center space-y-2">
              <div className="flex items-center justify-center gap-2 flex-wrap">
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={quietDays}
                  onChange={(e) => setQuietDays(e.target.value)}
                  aria-label="Quiet days"
                  className="au-card px-2 py-1.5 text-sm text-center"
                  style={{ width: 64, background: "none", color: "var(--ink)" }}
                />
                <span className="au-kicker">days ·</span>
                <input
                  value={quietReason}
                  onChange={(e) => setQuietReason(e.target.value)}
                  placeholder="reason (sick, travel…)"
                  aria-label="Quiet reason"
                  className="au-card px-2 py-1.5 text-sm"
                  style={{ width: 180, background: "none", color: "var(--ink)" }}
                />
                <Btn onClick={goQuiet} disabled={quietBusy}>
                  {quietBusy ? "…" : "Go quiet"}
                </Btn>
              </div>
              <p className="au-kicker" style={{ display: "block", fontSize: 12.5 }}>
                away or sick? the pushy rituals pause, follow-ups shift past the window, and everything resumes itself
              </p>
            </div>
          )}
          {quietMsg && (
            <p className="text-xs text-center" style={{ color: "var(--ink2)" }}>{quietMsg}</p>
          )}
        </section>

        <section className="space-y-3">
          <SectionLabel>Everything, honestly</SectionLabel>
          {err && <p className="text-sm text-center" style={{ color: "var(--attn)" }}>{err}</p>}
          {items === null && !err && <p className="au-kicker text-center" style={{ display: "block" }}>…</p>}
          <div className="space-y-1">
            {sorted.map((it) => (
              <div key={it.name} className="flex items-start gap-3 px-1 py-2" style={{ borderBottom: "1px solid var(--line1)" }}>
                <span className="mt-1.5 w-2 h-2 rounded-full shrink-0" style={LIGHT[it.status]?.dot ?? { background: "var(--ink3)" }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="text-sm" style={{ color: "var(--ink)" }}>{it.name}</span>
                    <span
                      className="text-[10px] uppercase"
                      style={{ fontFamily: "var(--font-body),Georgia,serif", fontWeight: 600, letterSpacing: ".2em", color: "var(--ink3)" }}
                    >
                      {LIGHT[it.status]?.label}
                    </span>
                  </div>
                  {it.status !== "live" && it.need && (
                    <p className="au-kicker mt-0.5" style={{ display: "block", fontSize: 12.5 }}>{it.need}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
