"use client";

// THE MACHINE — the status wall. One identity across /engines, /tools and
// /settings; this is the front door. Every integration and every mind shows
// its honest state — live burns gold, dormant says exactly what env it needs
// (hard rule 4, "dormant until configured", made visible). Status is
// LIVE-DERIVED from the backend registries, never hardcoded.
//
// ELEVATED IMPERIAL re-dress (docs/REDESIGN_PLAN.md): same /api/engines
// fetch + routing table survive; the wall reads /api/tools (existing route)
// and the stat row reads /api/scoreboard (existing route). No new backend.

import { useEffect, useState } from "react";
import { Panel, Stat, Divider } from "../../../components/kit";

type Routing = { tier: string; provider: string; model: string; when: string; configured: boolean };
type EngineInfo = { name: string; description: string };
type Data = { engines: EngineInfo[]; routing: Routing[]; embeddings: { provider: string } };

type Integration = {
  name: string;
  status: "live" | "partial" | "config" | "deploy" | "planned" | "parked";
  desc: string;
  glyph: string;
  need?: string;
};

// The wall dot: live = gold with glow, partial = gold unlit, everything else
// hollow — an engine without its key does not get to glow.
function WallDot({ status }: { status: Integration["status"] }) {
  const live = status === "live";
  const partial = status === "partial";
  return (
    <span
      className={`shrink-0 rounded-full ${live ? "au-breathe" : ""}`}
      style={{
        width: 9,
        height: 9,
        background: live || partial ? "var(--gold)" : "none",
        border: live || partial ? "none" : "1px solid var(--ink3)",
        boxShadow: live ? "0 0 8px rgba(212,175,55,.35)" : "none",
      }}
      aria-hidden="true"
    />
  );
}

const STATUS_TEXT: Record<Integration["status"], string> = {
  live: "live",
  partial: "partial",
  config: "needs a key",
  deploy: "wakes at the Mini",
  planned: "not built yet",
  parked: "parked",
};

export default function EnginesPage() {
  const [data, setData] = useState<Data | null>(null);
  const [failed, setFailed] = useState(false);
  const [integrations, setIntegrations] = useState<Integration[] | null>(null);
  const [week, setWeek] = useState<{ acted7: number; undone7: number; pendingNow: number } | null>(null);

  useEffect(() => {
    fetch("/api/engines")
      .then(async (r) => (r.ok ? setData(await r.json()) : setFailed(true)))
      .catch(() => setFailed(true));
    // The status wall — same truth source as /tools and /settings.
    fetch("/api/tools")
      .then(async (r) => (r.ok ? setIntegrations((await r.json()).integrations ?? []) : setIntegrations(null)))
      .catch(() => setIntegrations(null));
    // The record — how much the machine did this week (existing endpoint).
    fetch("/api/scoreboard")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j?.autonomy && setWeek(j.autonomy))
      .catch(() => {});
  }, []);

  // N of M armed — derived from the wall when it loaded, else from routing.
  const wall = integrations ?? [];
  const armed = wall.filter((i) => i.status === "live" || i.status === "partial").length;
  const routingArmed = data?.routing.filter((r) => r.configured).length ?? 0;
  const kicker =
    wall.length > 0
      ? `${armed} of ${wall.length} engines armed — the rest wake when you hand them a key`
      : data
        ? `${routingArmed} of ${data.routing.length} minds armed — the rest wake when you hand them a key`
        : failed
          ? "couldn't reach the brain"
          : "…";

  const order: Integration["status"][] = ["live", "partial", "config", "deploy", "planned", "parked"];
  const sortedWall = [...wall].sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status));

  return (
    <div className="au-horizon">
      <div className="max-w-5xl mx-auto pb-12 relative z-[1]">
        <header className="text-center pt-2">
          <h1 className="au-title" style={{ fontSize: "clamp(2rem,5vw,2.6rem)", lineHeight: 1.1, margin: 0 }}>
            The Machine
          </h1>
          <p className="au-kicker mt-2" style={{ display: "block", color: failed ? "var(--attn)" : undefined }}>
            {kicker}
          </p>
        </header>

        {/* THE STATUS WALL — every integration, honest about its state */}
        {sortedWall.length > 0 && (
          <div
            className="grid gap-3 mt-8"
            style={{ gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))" }}
          >
            {sortedWall.map((t) => (
              <div key={t.name} className="au-card flex items-center gap-3 px-4 py-3" title={t.desc}>
                <WallDot status={t.status} />
                <span
                  className="uppercase min-w-0 truncate"
                  style={{
                    fontFamily: "var(--font-body),Georgia,serif", fontWeight: 600,
                    fontSize: 13.5, letterSpacing: ".14em", color: "var(--ink2)",
                  }}
                >
                  {t.name}
                </span>
                <span
                  className="ml-auto text-right shrink"
                  style={{
                    fontFamily: "var(--font-data),Arial,sans-serif", fontWeight: 500, fontSize: 11,
                    letterSpacing: ".06em",
                    color: t.status === "live" || t.status === "partial" ? "var(--ink3)" : "var(--attn)",
                  }}
                >
                  {t.status === "live" || t.status === "partial" || !t.need ? STATUS_TEXT[t.status] : t.need}
                </span>
              </div>
            ))}
          </div>
        )}
        {integrations === null && !failed && (
          <p className="au-kicker text-center mt-6" style={{ display: "block" }}>
            the wall is loading — or the brain is out of reach
          </p>
        )}

        {/* The record — acts this week, straight off the scoreboard */}
        {week && (
          <div className="au-lit grid grid-cols-3 gap-6 max-w-2xl mx-auto mt-10">
            <Stat label="acts this week" value={week.acted7} pct={week.acted7 > 0 ? 80 : 0} />
            <Stat label="undone by you" value={week.undone7} pct={week.undone7 > 0 ? 20 : 0} tone={week.undone7 > 0 ? "alert" : undefined} />
            <Stat label="awaiting you" value={week.pendingNow} pct={week.pendingNow > 0 ? 40 : 0} />
          </div>
        )}
        <p className="au-kicker text-center mt-6" style={{ display: "block" }}>
          missions · autonomy dial · traces · spine —{" "}
          <a href="/aurelius" className="underline underline-offset-2" style={{ color: "var(--gold)", fontStyle: "normal" }}>
            in Tuning
          </a>
        </p>

        <Divider />

        {/* ROUTING — which mind answers which kind of call (survives, restyled) */}
        <Panel label="The minds — which engine answers what">
          <p className="au-kicker text-center -mt-2 mb-4" style={{ display: "block", fontSize: 13.5 }}>
            one task, the right mind — the router picks per call; unarmed tiers fall through to the default
          </p>
          <div className="space-y-2 max-w-3xl mx-auto">
            {(data?.routing ?? []).map((r) => (
              // Wraps at 390px (alignment council) — fixed widths overflowed the phone.
              <div key={r.tier} className="au-card flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{
                    background: r.configured ? "var(--gold)" : "none",
                    border: r.configured ? "none" : "1px solid var(--ink3)",
                    boxShadow: r.configured ? "0 0 6px rgba(212,175,55,.4)" : "none",
                  }}
                  title={r.configured ? "key configured" : "no key — dormant"}
                />
                <span
                  className="uppercase w-28 shrink-0"
                  style={{ fontFamily: "var(--font-body),Georgia,serif", fontWeight: 600, fontSize: 12.5, letterSpacing: ".14em", color: "var(--ink2)" }}
                >
                  {r.tier}
                </span>
                <span className="text-sm min-w-0 flex-1 truncate" style={{ color: "var(--ink)" }}>
                  {r.model}
                  <span style={{ color: "var(--ink3)" }}> · {r.provider}</span>
                </span>
                <span className="au-kicker basis-full sm:basis-0 sm:flex-1 sm:min-w-[180px]" style={{ fontSize: 12.5 }}>
                  {r.when}
                </span>
              </div>
            ))}
          </div>
          {data && (
            <p className="au-kicker text-center mt-4" style={{ display: "block", fontSize: 12.5 }}>
              embeddings · {data.embeddings.provider} — recall runs on pgvector
            </p>
          )}
        </Panel>

        <Divider />

        {/* CORE ENGINES — internal machinery registered at boot (survives, restyled) */}
        <Panel label="Core engines">
          <p className="au-kicker text-center -mt-2 mb-4" style={{ display: "block", fontSize: 13.5 }}>
            internal machinery registered at boot — these do work, not chat
          </p>
          {(data?.engines ?? []).length === 0 ? (
            <p className="au-kicker text-center" style={{ display: "block" }}>Registry empty.</p>
          ) : (
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-sm max-w-4xl mx-auto">
              {data!.engines.map((e) => (
                <li key={e.name} className="au-card px-4 py-2.5">
                  <span style={{ color: "var(--gold)" }}>{e.name}</span>
                  {e.description && <p className="text-xs mt-1" style={{ color: "var(--ink3)" }}>{e.description}</p>}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
