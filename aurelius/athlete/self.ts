// aurelius/athlete/self.ts
//
// ATHLETE ZERO (NORTH_STAR #44) — Cole as his own tracked athlete, on his own
// surface. He asked for a distinct tab, not a roster row: this is that record.
//
// It's a Client with kind="self" — which reuses the ENTIRE coaching eye
// (metrics, PRs, targets, performance, development curves, readiness) on Cole
// himself, while being excluded from BOTH:
//   • the business funnel — every business query already filters kind:"client",
//     so a self record can never become a lead/invoice/referral target, and
//   • the coached-athlete roster/sweeps — those filter to COACHED_KINDS below,
//     so Cole never shows up among the athletes he coaches or in their signals.
// That double-exclusion is the whole safety story; COACHED_KINDS is the single
// place the roster boundary is defined so a new athlete query can't drift.

import { prisma } from "../core/db/prisma.ts";

/** The kinds that ARE Cole's coached athletes — the roster and its sweeps use
 *  this so the self record (kind:"self") is never counted among them. */
export const COACHED_KINDS = ["client", "training_only"] as const;

/** Cole's self athlete record, created lazily on first use. Idempotent. */
export async function getOrCreateSelf(): Promise<{ id: string; name: string }> {
  const existing = await prisma.client.findFirst({ where: { kind: "self" }, select: { id: true, name: true } });
  if (existing) return existing;
  const { IDENTITY } = await import("../identity/index.ts");
  const name = IDENTITY?.profile?.name || "Cole";
  const created = await prisma.client.create({
    data: { name, kind: "self", status: "active" },
    select: { id: true, name: true },
  });
  console.log(`[athleteZero] created self record for ${name} (${created.id})`);
  return created;
}

/** Read-only: the self record if it exists (null before first use). */
export async function getSelf(): Promise<{ id: string; name: string } | null> {
  return prisma.client.findFirst({ where: { kind: "self" }, select: { id: true, name: true } });
}

/** Log one of Cole's OWN numbers onto the self record. This is what makes
 *  Athlete Zero a place he can PUT his training into, not just read it. Reuses
 *  logMetric (PR detection included) against the self record — onPeak routes a
 *  self PR to the training branch, so it surfaces a training win and fires zero
 *  business machinery. */
export async function logSelfMetric(input: { label: string; value: number; unit?: string }): Promise<{ ok: boolean; isPR?: boolean; error?: string }> {
  const label = (input.label ?? "").trim();
  if (!label || !Number.isFinite(input.value)) return { ok: false, error: "Need a label and a numeric value." };
  const self = await getOrCreateSelf();
  const { logMetric } = await import("../crm/retention.ts");
  const m = await logMetric({ clientId: self.id, label, value: input.value, unit: input.unit });
  return { ok: true, isPR: !!m.isPR };
}

/** Set one of Cole's OWN targets on the self record. */
export async function setSelfTarget(input: { label: string; targetValue: number; unit?: string; targetDate?: string }): Promise<{ ok: boolean; error?: string }> {
  const label = (input.label ?? "").trim();
  if (!label || !Number.isFinite(input.targetValue)) return { ok: false, error: "Need a label and a numeric target." };
  const self = await getOrCreateSelf();
  const { setTarget } = await import("../crm/targets.ts");
  await setTarget({ clientId: self.id, label, targetValue: input.targetValue, unit: input.unit ?? null, targetDate: input.targetDate ?? null });
  return { ok: true };
}

/**
 * Athlete Zero in one read: Cole's own training picture (performance series,
 * development curves) plus his latest readiness (WHOOP, when configured). The
 * /zero tab and the self.zero tool both render this. Creates the self record on
 * first call so the tab is never empty-because-uninitialised.
 */
export async function athleteZeroSummary(): Promise<{
  self: { id: string; name: string };
  performance: Awaited<ReturnType<typeof import("../crm/performance.ts").athletePerformance>>;
  curves: Awaited<ReturnType<typeof import("../training/devCurves.ts").developmentCurves>>;
  readiness: Awaited<ReturnType<typeof import("../health/whoop.ts").latestReadiness>>;
}> {
  const self = await getOrCreateSelf();
  const [{ athletePerformance }, { developmentCurves }, { latestReadiness }] = await Promise.all([
    import("../crm/performance.ts"),
    import("../training/devCurves.ts"),
    import("../health/whoop.ts"),
  ]);
  const [performance, curves, readiness] = await Promise.all([
    athletePerformance(self.id).catch(() => null),
    developmentCurves(self.id).catch(() => null),
    latestReadiness().catch(() => null),
  ]);
  return { self, performance, curves, readiness };
}
