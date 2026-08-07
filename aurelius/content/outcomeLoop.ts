// aurelius/content/outcomeLoop.ts
//
// THE CONTENT-OUTCOME LOOP — the read-back leg publishing never had.
//
// Wave 1 stamped every published post with an OutwardArtifact (its IG media id,
// permalink, and the angles it embodies) and minted a tracked link. That closed
// the LEAD side of attribution (a click → intake → paid touch). This closes the
// CONTENT side: ~72h after a post goes out — long enough for its reach to
// settle — read its real insights, credit the angle it came from (a published
// post IS a use of that angle, which nothing was recording automatically), and
// store reach/engagement so "leads ÷ reach" becomes a real number.
//
// Config-gated and dormant-honest: with no Instagram connection it does nothing
// and says so. Idempotent: insightsReadAt marks an artifact processed, so a
// daily sweep credits each post exactly once.

import { prisma } from "../core/db/prisma.ts";

const SETTLE_MS = 72 * 3600 * 1000; // reach settles by ~3 days
const MAX_PER_SWEEP = 20;
// Give a post a few days for its insights to appear in the recent-media window
// before we give up and mark it read regardless (so a missed post can't wedge
// the sweep forever).
const GIVE_UP_MS = 10 * 24 * 3600 * 1000;

export type ContentOutcomeResult = {
  ran: boolean;
  reason: string;
  processed: number;
  reinforced: number;
};

export async function runContentOutcomeSweep(): Promise<ContentOutcomeResult> {
  const now = Date.now();
  const due = await prisma.outwardArtifact.findMany({
    where: {
      channel: "instagram",
      externalId: { not: null },
      insightsReadAt: null,
      publishedAt: { lte: new Date(now - SETTLE_MS) },
    },
    orderBy: { publishedAt: "asc" },
    take: MAX_PER_SWEEP,
  });
  if (due.length === 0) return { ran: false, reason: "nothing settled to read", processed: 0, reinforced: 0 };

  // Config gate: read insights only when Instagram is actually connected.
  let metricsById = new Map<string, { reach: number; engagement: number }>();
  try {
    const { getInstagramCreds } = await import("../instagram/auth.ts");
    if (!(await getInstagramCreds())) {
      return { ran: false, reason: "instagram not connected — content-outcome loop dormant", processed: 0, reinforced: 0 };
    }
    const { recentPostMetrics } = await import("../instagram/insights.ts");
    const metrics = await recentPostMetrics(50).catch(() => []);
    for (const m of metrics as any[]) {
      metricsById.set(String(m.id), { reach: Number(m.reach ?? 0), engagement: Number(m.engagement ?? 0) });
    }
  } catch (err) {
    return { ran: false, reason: `insights read failed: ${(err as any)?.message ?? err}`, processed: 0, reinforced: 0 };
  }

  const { recordOutcome } = await import("../business/marketing.ts");
  let processed = 0;
  let reinforced = 0;
  const perAngle: Array<{ angle: string; reach: number; engagement: number }> = [];

  for (const art of due) {
    const m = metricsById.get(String(art.externalId));
    if (!m) {
      // Not in the recent window yet. Leave it for a later sweep — unless it's
      // now too old to ever appear, in which case mark it read so it can't wedge.
      if (art.publishedAt.getTime() < now - GIVE_UP_MS) {
        await prisma.outwardArtifact.update({ where: { id: art.id }, data: { insightsReadAt: new Date() } }).catch(() => {});
      }
      continue;
    }
    // Credit each angle this post embodies — publishing IS a use of the angle,
    // and nothing was recording that automatically (recordOutcome had only
    // manual callers). Best-effort: a bad angle id must not stop the sweep.
    for (const angleId of art.angleIds) {
      const angle = await prisma.marketingAngle.findUnique({ where: { id: angleId }, select: { title: true } }).catch(() => null);
      if (!angle) continue;
      await recordOutcome({ angleId, used: 1 }).catch(() => {});
      reinforced++;
      perAngle.push({ angle: angle.title, reach: m.reach, engagement: m.engagement });
    }
    await prisma.outwardArtifact.update({
      where: { id: art.id },
      data: { insightsReadAt: new Date(), reach: m.reach, engagementCount: m.engagement },
    });
    processed++;
  }

  // One digest — what landed and what didn't. Engagement per angle is the signal
  // the marketing pass and Cole read to lean into what works.
  if (processed > 0) {
    try {
      const { surfaceSignal } = await import("../core/bridge.ts");
      const best = [...perAngle].sort((a, b) => b.engagement - a.engagement)[0];
      const worst = [...perAngle].sort((a, b) => a.engagement - b.engagement)[0];
      await surfaceSignal({
        kind: "background_result",
        domain: "content",
        sourceType: "content_outcome",
        sourceId: `outcome:${new Date().toISOString().slice(0, 10)}`,
        severity: "info",
        title: `Read the numbers on ${processed} post${processed === 1 ? "" : "s"}`,
        body:
          (best ? `Best: "${best.angle}" — ${best.reach} reach, ${best.engagement} engagements.\n` : "") +
          (worst && worst !== best ? `Weakest: "${worst.angle}" — ${worst.reach} reach, ${worst.engagement} engagements.\n` : "") +
          `Each post's angle got credited a use, and reach is now on the record so leads-per-reach is a real number.`,
      }).catch(() => {});
    } catch { /* digest is a bonus */ }
  }

  return { ran: true, reason: "read", processed, reinforced };
}
