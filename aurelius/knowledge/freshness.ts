// aurelius/knowledge/freshness.ts
//
// KNOWLEDGE FRESHNESS (NORTH_STAR block 9, the unbuilt half) — knowledge
// ages, and stale knowledge quietly steering decisions is worse than a
// gap. Deterministic: every scope has a half-life; entries past it are
// stale. The weekly sweep files freshness_recheck PROPOSALS for the
// stalest few (propose, never impose — confirming re-anchors the entry,
// correcting updates it, denying leaves it be) plus one Bridge summary.
// No LLM anywhere in this path.

import { prisma } from "../core/db/prisma.ts";
import { createProposal } from "./proposals.ts";

// Days until an entry counts as stale, by scope. Identity moves slowly;
// research topics rot fast. Anything unlisted gets the default.
const HALF_LIFE_DAYS: Record<string, number> = {
  persona: 180,
  identity: 180,
  autonomy: 120,
  system: 365, // cursors/tokens — infrastructure, not beliefs
  research: 30,
  rep_bands: 120,
  intensity_zones: 120,
  movement_patterns: 180,
  block_contexts: 120,
  fatigue_signals: 90,
};
const DEFAULT_HALF_LIFE = 90;
const MAX_PROPOSALS_PER_SWEEP = 5;
const REPROPOSE_COOLDOWN_DAYS = 30;

export function halfLifeFor(scope: string): number {
  return HALF_LIFE_DAYS[scope] ?? DEFAULT_HALF_LIFE;
}

/** 0 = just verified · 1 = exactly at half-life · >1 = stale. */
export function stalenessOf(updatedAt: Date, scope: string): number {
  const ageDays = (Date.now() - updatedAt.getTime()) / 86400_000;
  return +(ageDays / halfLifeFor(scope)).toFixed(2);
}

export type StaleEntry = {
  id: string;
  operatorId: string;
  operatorName: string;
  scope: string;
  key: string;
  value: unknown;
  updatedAt: Date;
  staleness: number;
  halfLifeDays: number;
};

export async function listStaleEntries(threshold = 1.0): Promise<StaleEntry[]> {
  const entries = await prisma.knowledgeEntry.findMany({
    where: { active: true },
    include: { operator: { select: { name: true } } },
  });
  return entries
    .map((e) => ({
      id: e.id,
      operatorId: e.operatorId,
      operatorName: e.operator?.name ?? "unknown",
      scope: e.scope,
      key: e.key,
      value: e.value,
      updatedAt: e.updatedAt,
      staleness: stalenessOf(e.updatedAt, e.scope),
      halfLifeDays: halfLifeFor(e.scope),
    }))
    .filter((e) => e.staleness >= threshold && e.scope !== "system") // infra keys never nag
    .sort((a, b) => b.staleness - a.staleness);
}

/**
 * Weekly sweep: propose re-verification for the stalest entries.
 * Capped per sweep, cooldown per entry — the bench never floods.
 */
export async function runFreshnessSweep() {
  const stale = await listStaleEntries();
  if (stale.length === 0) return { stale: 0, proposed: 0 };

  const cooldownSince = new Date(Date.now() - REPROPOSE_COOLDOWN_DAYS * 86400_000);
  let proposed = 0;

  for (const entry of stale) {
    if (proposed >= MAX_PROPOSALS_PER_SWEEP) break;
    // Skip anything already on (or recently through) the bench.
    const recent = await prisma.knowledgeProposal.findFirst({
      where: {
        operatorId: entry.operatorId,
        scope: entry.scope,
        key: entry.key,
        intentClassId: "freshness_recheck",
        OR: [{ status: "pending" }, { createdAt: { gte: cooldownSince } }],
      },
    });
    if (recent) continue;

    const ageDays = Math.round((Date.now() - entry.updatedAt.getTime()) / 86400_000);
    await createProposal({
      operatorId: entry.operatorId,
      operatorName: entry.operatorName,
      intentClassId: "freshness_recheck",
      scope: entry.scope,
      key: entry.key,
      proposedValue: entry.value,
      rationale: `${entry.scope}.${entry.key} hasn't been touched in ${ageDays} days (half-life ${entry.halfLifeDays}d). Confirm it still holds, correct it, or deny to leave it as-is.`,
      coleNaturalLanguage: "(freshness sweep — no conversation trigger)",
    });
    proposed++;
  }

  if (proposed > 0) {
    await prisma.bridgeSignal.create({
      data: {
        kind: "gap_alert",
        domain: "personal",
        sourceType: "system",
        severity: "notice",
        title: `Knowledge freshness: ${stale.length} stale entries, ${proposed} queued for re-check`,
        body:
          stale
            .slice(0, 8)
            .map((e) => `• ${e.operatorName}/${e.scope}.${e.key} — ${e.staleness}× half-life`)
            .join("\n") + "\n\nRe-checks are on the review bench.",
      },
    });
  }

  console.log(`[freshness] ${stale.length} stale, ${proposed} proposals filed`);
  return { stale: stale.length, proposed };
}
