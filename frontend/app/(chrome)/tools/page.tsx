"use client";

// TOOLS — Aurelius's hands. Status is LIVE-DERIVED from the backend
// (registry + config + connection checks), never hardcoded — so this
// page can't drift out of sync with reality the way a static roadmap
// does. If a card is wrong, the truth-source is aurelius/tools/
// integrationStatus.ts, not this file.
//
// ELEVATED IMPERIAL parity re-dress: same fetch, same content, Machine-wall
// styling — one identity across /engines, /tools, /settings.

import { useEffect, useState } from "react";
import { Panel } from "../../../components/kit";

type ToolInfo = { name: string; actions: string[] };
type Integration = {
  name: string;
  status: "live" | "partial" | "config" | "deploy" | "planned" | "parked";
  desc: string;
  glyph: string;
  need?: string;
};

// Imperial status palette — gold is earned, dormant states stay honest.
const STATUS_STYLE: Record<string, React.CSSProperties> = {
  live: { color: "var(--gold)", borderColor: "var(--gold-line)" },
  partial: { color: "var(--gold-dim)", borderColor: "var(--gold-line)" },
  config: { color: "var(--attn)", borderColor: "rgba(217,164,65,.4)" },
  deploy: { color: "var(--ink2)", borderColor: "var(--line2)" },
  planned: { color: "var(--ink3)", borderColor: "var(--line2)" },
  parked: { color: "var(--ink3)", borderColor: "var(--line1)" },
};
const STATUS_LABEL: Record<string, string> = {
  live: "live",
  partial: "partial",
  config: "needs a key",
  deploy: "at deploy",
  planned: "not built yet",
  parked: "parked",
};
const ORDER = ["live", "partial", "config", "deploy", "planned", "parked"];

export default function ToolsPage() {
  const [registered, setRegistered] = useState<ToolInfo[] | null>(null);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetch("/api/tools")
      .then(async (r) => {
        if (!r.ok) { setFailed(true); return; }
        const d = await r.json();
        setRegistered(d.registered ?? []);
        setIntegrations(d.integrations ?? []);
      })
      .catch(() => setFailed(true)); // a dead backend must not spin "…" forever
  }, []);

  const sorted = [...integrations].sort((a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status));
  const liveCount = integrations.filter((i) => i.status === "live" || i.status === "partial").length;

  return (
    <div className="au-horizon">
      <div className="max-w-4xl mx-auto pb-12 relative z-[1]">
        <header className="text-center pt-2">
          <h1 className="au-title" style={{ fontSize: "clamp(2rem,5vw,2.6rem)", lineHeight: 1.1, margin: 0 }}>
            Tools
          </h1>
          <p className="au-kicker mt-2" style={{ display: "block" }}>
            Aurelius's hands — read broadly, write narrowly; anything outward goes through propose → confirm.
            {integrations.length > 0 && (
              <> · {liveCount} live, {integrations.length - liveCount} waiting on a key or the Mini</>
            )}
          </p>
          {failed && (
            <p className="au-kicker mt-1" style={{ display: "block", color: "var(--attn)" }}>
              Couldn't reach the brain — statuses can't be shown right now.
            </p>
          )}
        </header>

        {registered && registered.length > 0 && (
          <div className="mt-8">
            <Panel tier="card" label="Registered in the Tool Engine" className="p-5">
              <ul className="space-y-2 text-sm">
                {registered.map((t) => (
                  <li key={t.name} className="flex items-baseline gap-2 flex-wrap">
                    <span
                      className="w-2 h-2 rounded-full shrink-0 self-center"
                      style={{ background: "var(--gold)", boxShadow: "0 0 6px rgba(212,175,55,.4)" }}
                    />
                    <span style={{ color: "var(--ink)" }}>{t.name}</span>
                    <span className="au-kicker" style={{ fontSize: 12.5 }}>{t.actions.join(" · ")}</span>
                  </li>
                ))}
              </ul>
            </Panel>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-8">
          {sorted.map((t) => (
            <div key={t.name} className="au-card p-4 flex items-start gap-3">
              <span className="text-xl mt-0.5" style={{ color: "var(--gold)" }}>{t.glyph}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className="uppercase"
                    style={{ fontFamily: "var(--font-body),Georgia,serif", fontWeight: 600, fontSize: 13.5, letterSpacing: ".14em", color: "var(--ink2)" }}
                  >
                    {t.name}
                  </span>
                  <span
                    className="text-[10px] uppercase tracking-wider border rounded-[2px] px-1.5 py-0.5 shrink-0"
                    style={STATUS_STYLE[t.status]}
                  >
                    {STATUS_LABEL[t.status]}
                  </span>
                </div>
                <p className="text-xs mt-1" style={{ color: "var(--ink3)" }}>{t.desc}</p>
                {t.need && (
                  <p className="au-kicker mt-1.5" style={{ display: "block", fontSize: 12 }}>→ {t.need}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
