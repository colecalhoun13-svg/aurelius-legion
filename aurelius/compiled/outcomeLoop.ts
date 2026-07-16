// aurelius/compiled/outcomeLoop.ts
//
// THE OUTCOME LOOP (decision spine #2) — the error signal the lens was missing.
//
// Every heuristic was born at confidenceScore 0.5 and NOTHING ever moved it: a
// rule Cole kept overriding stayed exactly as trusted as one that earned ten good
// calls. The lens accumulated; it never sharpened. This closes that:
//
//   FIRE    — decision turns record which patterns actually informed the answer
//             (a queryable trace row; also the audit trail for "what informed that?").
//   DECAY   — when Cole corrects a recent decision, the patterns that informed it
//             lose confidence (bounded). Repeatedly-wrong rules fall below the
//             TRUST_FLOOR and stop loading — decayed out, not silently forever-on.
//   REINFORCE — patterns that keep informing decisions WITHOUT drawing a
//             correction gain a little (weak positive evidence, capped well below
//             what Cole's explicit confirm asserts).
//
// Asymmetry is deliberate: one correction outweighs several quiet weeks. Cole's
// explicit hand stays the strongest signal in the system (a direct correction on a
// pattern still discards it outright — see knowledge/corrections.ts).

import { prisma } from "../core/db/prisma.ts";

export const DECAY_STEP = 0.12;       // one corrected decision costs real trust
export const REINFORCE_STEP = 0.02;   // surviving live fire earns a little
export const CONFIDENCE_MIN = 0.05;
export const REINFORCE_CAP = 0.9;     // implicit evidence never rivals explicit confirm
export const TRUST_FLOOR = 0.15;      // below this a pattern stops loading into prompts

const FIRED_MSG = "decision:patterns_fired";
const DECAYED_MSG = "decision:patterns_decayed";

async function traceOperatorId(): Promise<string | null> {
  const { resolveOperatorId } = await import("../knowledge/store.ts");
  return resolveOperatorId("global").catch(() => null);
}

/**
 * Record which compiled patterns informed a decision turn. Awaitable (unlike
 * traceEvent) so tests and callers that need read-after-write can rely on it;
 * the router calls it fire-and-forget. The row doubles as the audit trail —
 * provenance stays OUT of the answer (invisible lens) but IN the system.
 */
export async function recordPatternsFired(patternIds: string[], decision: string): Promise<void> {
  if (patternIds.length === 0) return;
  const operatorId = await traceOperatorId();
  if (!operatorId) return;
  const { currentTraceId } = await import("../core/traceContext.ts");
  const traceId = currentTraceId();
  await prisma.logEntry.create({
    data: {
      operatorId,
      type: "trace",
      level: "info",
      message: FIRED_MSG,
      context: {
        kind: "decision",
        name: "patterns_fired",
        patternIds,
        decision: decision.slice(0, 200),
        ...(traceId ? { traceId } : {}),
      } as any,
    },
  });
}

/** Bounded confidence adjustment with an evidence note (audit trail in the row). */
export async function adjustPatternConfidence(patternId: string, delta: number, note: string): Promise<number | null> {
  const p = await prisma.compiledPattern.findUnique({ where: { id: patternId } });
  if (!p) return null;
  const cur = p.confidenceScore ?? 0;
  // A reward must never lower trust: above the cap, reinforcement is a no-op
  // (the old min() clamp wrote a 1.0 pattern DOWN to 0.9 — reward as punishment).
  const next =
    delta > 0
      ? cur >= REINFORCE_CAP
        ? cur
        : Math.min(REINFORCE_CAP, cur + delta)
      : Math.max(CONFIDENCE_MIN, cur + delta);
  if (next === cur) return next;
  await prisma.compiledPattern.update({
    where: { id: patternId },
    data: { confidenceScore: next, evidence: { push: `outcome: ${note}` } },
  });
  return next;
}

/**
 * Decay EXACTLY the named patterns (the correction front door passes the rules
 * Cole was looking at — no address inference). Facts are exempt: a correction
 * about judgment must never erase an auto-compiled FACT that merely sat in the
 * prompt; discarded patterns are already dead. Emits a decayed marker so
 * grading never rewards a rule in the same breath it was punished.
 */
export async function decayPatterns(args: { patternIds: string[]; reason: string }): Promise<number> {
  const ids = [...new Set(args.patternIds)].filter((v) => typeof v === "string" && v.length > 0);
  if (ids.length === 0) return 0;
  const eligible = await prisma.compiledPattern.findMany({
    where: { id: { in: ids }, status: { notIn: ["auto_factual", "discarded"] } },
    select: { id: true },
  });

  let decayed = 0;
  for (const { id } of eligible) {
    const next = await adjustPatternConfidence(id, -DECAY_STEP, `decayed — Cole corrected a decision this informed (${args.reason.slice(0, 120)})`);
    if (next !== null) decayed++;
  }
  const operatorId = await traceOperatorId();
  if (operatorId && decayed > 0) {
    await prisma.logEntry.create({
      data: {
        operatorId, type: "trace", level: "info", message: DECAYED_MSG,
        context: { kind: "decision", name: "patterns_decayed", patternIds: eligible.map((e) => e.id), reason: args.reason.slice(0, 200) } as any,
      },
    });
  }
  return decayed;
}

/**
 * Fallback when a correction arrives WITHOUT naming rules (no front-door
 * context): grade the most recent UNCONSUMED fired-set within the window, then
 * consume it — a second correction can never double-decay the same event.
 */
export async function decayRecentlyFired(args: { reason: string; withinHours?: number }): Promise<number> {
  const withinHours = args.withinHours ?? 48;
  // Consumed-filter in code: a JSON-path NOT-equals in SQL silently drops rows
  // where the key is absent (NULL three-valued logic), which is every fresh row.
  const recent = await prisma.logEntry.findMany({
    where: {
      type: "trace",
      message: FIRED_MSG,
      createdAt: { gte: new Date(Date.now() - withinHours * 3600_000) },
    },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  const fired = recent.find((r) => (r.context as any)?.consumed !== true);
  if (!fired) return 0;
  const ids: string[] = ((fired.context as any)?.patternIds ?? []).filter((v: any) => typeof v === "string");
  if (ids.length === 0) return 0;

  // Consume BEFORE decaying — even if a decay write fails midway, the event
  // can't be re-graded (idempotency beats completeness for punishment).
  await prisma.logEntry.update({
    where: { id: fired.id },
    data: { context: { ...(fired.context as any), consumed: true } as any },
  });
  return decayPatterns({ patternIds: ids, reason: args.reason });
}

/**
 * Weekly grading (rides the Sunday decision-curriculum job): patterns that
 * informed decisions this window and drew NO correction and NO decay gain a
 * small reinforcement. Weak evidence, deliberately capped — surviving quiet
 * weeks never rivals Cole's explicit confirm.
 */
export async function reinforceSurvivors(args?: { sinceDays?: number }): Promise<number> {
  const since = new Date(Date.now() - (args?.sinceDays ?? 7) * 86_400_000);
  const events = await prisma.logEntry.findMany({
    where: { type: "trace", message: { in: [FIRED_MSG, DECAYED_MSG] }, createdAt: { gte: since } },
    orderBy: { createdAt: "asc" },
  });

  const firedIds = new Set<string>();
  const decayedIds = new Set<string>();
  for (const e of events) {
    const ids: string[] = ((e.context as any)?.patternIds ?? []).filter((v: any) => typeof v === "string");
    for (const id of ids) (e.message === DECAYED_MSG ? decayedIds : firedIds).add(id);
  }
  if (firedIds.size === 0) return 0;

  // Any correction directly on the pattern in-window also disqualifies it.
  const corrected = await prisma.correction.findMany({
    where: { targetType: "compiled_pattern", targetId: { in: [...firedIds] }, createdAt: { gte: since } },
    select: { targetId: true },
  });
  for (const c of corrected) decayedIds.add(c.targetId);

  let reinforced = 0;
  for (const id of firedIds) {
    if (decayedIds.has(id)) continue;
    const next = await adjustPatternConfidence(id, REINFORCE_STEP, "reinforced — informed decisions without drawing a correction");
    if (next !== null) reinforced++;
  }
  return reinforced;
}
