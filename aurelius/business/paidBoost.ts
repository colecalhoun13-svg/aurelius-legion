// aurelius/business/paidBoost.ts
//
// MEASURED PAID BOOST — spend only behind proof, and kill it fast.
//
// Cole is fine spending on ads — he just won't "spend out the ass" for it. So
// this refuses the two ways paid spend usually wastes money:
//   1. NEVER boost an unproven post. A boost amplifies whatever the post already
//      does; amplifying a dud buys more dud. This only proposes a boost for a
//      post that ALREADY beat the account's own median reach organically.
//   2. NEVER spend without a kill line. Every boost carries a cost-per-lead
//      target and a hard kill threshold up front, and the spend itself is an
//      OUTWARD action (ads.spend) — Cole confirms it, every time.
//
// Config-gated (META_ADS_TOKEN) and dormant-honest: it proposes with real
// organic numbers even before a token exists, and the actual spend fails loudly
// until the token (and Cole's confirm) are both present.

import { prisma } from "../core/db/prisma.ts";

export function paidAdsConfigured(): boolean {
  return !!process.env.META_ADS_TOKEN;
}

// The kill line: if a boost's cost-per-lead exceeds this, it's not working.
const DEFAULT_KILL_CPL_CENTS = 5000; // $50/lead — Cole can override per boost
const DEFAULT_BUDGET_CENTS = 2000; // $20 test spend by default

/**
 * Find an organically-proven post worth boosting and propose it (the spend is
 * gated). "Proven" = reach above the median of the last posts that have insights.
 * Returns the proposal, or an honest reason there's nothing to boost yet.
 */
export async function proposeBoost(opts: { budgetCents?: number; killCplCents?: number } = {}): Promise<{
  ok: boolean;
  reason: string;
  artifactId?: string;
  reach?: number;
  budgetCents?: number;
  killCplCents?: number;
}> {
  // Only posts we've actually measured (Wave 3 content-outcome loop).
  const measured = await prisma.outwardArtifact.findMany({
    where: { channel: "instagram", reach: { not: null }, insightsReadAt: { not: null } },
    select: { id: true, reach: true, engagementCount: true, permalink: true },
    orderBy: { publishedAt: "desc" },
    take: 30,
  });
  if (measured.length < 3) {
    return { ok: false, reason: "not enough measured posts to know what's proven — keep posting organically first" };
  }
  const reaches = measured.map((m) => m.reach ?? 0).sort((a, b) => a - b);
  const median = reaches[Math.floor(reaches.length / 2)] ?? 0;
  // The best post that also beats the median (proof, not just the top of a weak field).
  const proven = [...measured].sort((a, b) => (b.reach ?? 0) - (a.reach ?? 0)).find((m) => (m.reach ?? 0) > median);
  if (!proven) {
    return { ok: false, reason: "no post is clearly beating your own median yet — nothing proven enough to amplify" };
  }
  return {
    ok: true,
    reason: "found a post beating your organic median — worth a measured boost",
    artifactId: proven.id,
    reach: proven.reach ?? 0,
    budgetCents: opts.budgetCents ?? DEFAULT_BUDGET_CENTS,
    killCplCents: opts.killCplCents ?? DEFAULT_KILL_CPL_CENTS,
  };
}

/**
 * STAGE a measured boost → GATE the spend for Cole's confirm. The council's
 * missing invoker: ads.spend had a finalizer (finalizeBoost) but no stager, so
 * no pending confirm could ever be created and the finalizer was unreachable.
 * This runs proposeBoost first (only a post beating your organic median is worth
 * amplifying), then routes through executeAction — which ALWAYS gates an outward
 * class. finalizeBoost runs only on Cole's tap. Honest when nothing's proven yet.
 */
export async function stageBoost(opts: { budgetCents?: number; killCplCents?: number } = {}): Promise<{
  ok: boolean;
  gated?: boolean;
  bridgeSignalId?: string;
  reason: string;
  artifactId?: string;
}> {
  const proposal = await proposeBoost(opts);
  if (!proposal.ok || !proposal.artifactId) return { ok: false, reason: proposal.reason };

  const budgetCents = proposal.budgetCents ?? DEFAULT_BUDGET_CENTS;
  const killCplCents = proposal.killCplCents ?? DEFAULT_KILL_CPL_CENTS;
  const dollars = (c: number) => `$${(c / 100).toFixed(2)}`;

  const { executeAction } = await import("../autonomy/executor.ts");
  const exec = await executeAction({
    actionClass: "ads.spend",
    sourceType: "ads_boost",
    sourceId: `boost:${proposal.artifactId}`, // one open confirm per proven post
    prepare: async () => ({
      title: `Boost a proven post — ${dollars(budgetCents)} test spend?`,
      body:
        `This post beat your organic median (${proposal.reach} reach) — the one condition worth paying to amplify. ` +
        `Test budget ${dollars(budgetCents)}, kill line ${dollars(killCplCents)}/lead. ` +
        `Confirm to spend; the boost stands down the moment cost-per-lead crosses the kill line.`,
      domain: "business",
      payload: { artifactId: proposal.artifactId, budgetCents, killCplCents },
    }),
  });
  return { ok: true, gated: !exec.finalized, bridgeSignalId: exec.bridgeSignalId, reason: proposal.reason, artifactId: proposal.artifactId };
}

/**
 * The finalizer for the OUTWARD ads.spend action — runs ONLY on Cole's confirm.
 * Dormant-honest without a token: fails loudly, once, with the fix. Records the
 * spend so cost-per-lead can be tracked against the boost.
 */
export async function finalizeBoost(payload: { artifactId?: string; budgetCents?: number; killCplCents?: number }): Promise<any> {
  if (!paidAdsConfigured()) {
    throw new Error("Meta ads not configured — set META_ADS_TOKEN (and connect an ad account) before spending.");
  }
  const budgetCents = payload?.budgetCents ?? DEFAULT_BUDGET_CENTS;
  // NOTE: the real Meta Marketing API call to create the boosted post goes here
  // once Cole connects an ad account; it's intentionally not faked. Record the
  // spend now so the CPL tracker (boostStanding) has a denominator.
  const { resolveOperatorId } = await import("../knowledge/store.ts");
  const opId = await resolveOperatorId("business").catch(() => null);
  if (opId) {
    await prisma.logEntry.create({
      data: { operatorId: opId, type: "ad_spend", level: "info", message: payload?.artifactId ?? "boost", context: { budgetCents, killCplCents: payload?.killCplCents ?? DEFAULT_KILL_CPL_CENTS } },
    }).catch(() => {});
  }
  return { ok: true, artifactId: payload?.artifactId, budgetCents, note: "spend recorded; wire the Meta Marketing API call when the ad account is connected" };
}

/**
 * Where the paid experiment stands: spend, leads it produced, live CPL, and the
 * kill verdict. Silent-honest: no spend yet → nothing to judge.
 */
export async function boostStanding(): Promise<{
  active: boolean;
  spentCents: number;
  leads: number;
  cplCents: number | null;
  verdict: string;
}> {
  const spends = await prisma.logEntry.findMany({ where: { type: "ad_spend" }, select: { context: true } });
  const spentCents = spends.reduce((s, r) => s + (Number((r.context as any)?.budgetCents) || 0), 0);
  if (spentCents === 0) return { active: false, spentCents: 0, leads: 0, cplCents: null, verdict: "No paid spend yet." };
  // Leads attributed to a paid/instagram touch SINCE spending started. The old
  // count was all-time, so organic Instagram leads earned long before any boost
  // flattered the CPL — the denominator has to start when the money did, or the
  // kill line reads a number the spend didn't earn (council minor). Bound it to
  // the first ad_spend timestamp; per-boost attribution sharpens this once the ad
  // account lands, but until then "since first spend" is the honest window.
  const firstSpendAt = await prisma.logEntry
    .findFirst({ where: { type: "ad_spend" }, orderBy: { createdAt: "asc" }, select: { createdAt: true } })
    .catch(() => null);
  const leads = await prisma.attributionEvent.count({
    where: {
      kind: "intake",
      channel: { in: ["instagram", "paid", "ads"] },
      ...(firstSpendAt ? { createdAt: { gte: firstSpendAt.createdAt } } : {}),
    },
  });
  const cplCents = leads > 0 ? Math.round(spentCents / leads) : null;
  const killCpl = Number((spends[0]?.context as any)?.killCplCents) || DEFAULT_KILL_CPL_CENTS;
  const verdict =
    cplCents === null
      ? `Spent ${(spentCents / 100).toFixed(2)} and zero leads yet — watch it, this is where money leaks.`
      : cplCents > killCpl
        ? `Cost-per-lead is $${(cplCents / 100).toFixed(2)} — over the $${(killCpl / 100).toFixed(2)} kill line. Stop the boost.`
        : `Cost-per-lead is $${(cplCents / 100).toFixed(2)}, under the kill line. It's working — let it run.`;
  return { active: true, spentCents, leads, cplCents, verdict };
}
