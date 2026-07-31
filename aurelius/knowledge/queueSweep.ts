// aurelius/knowledge/queueSweep.ts
//
// QUEUE JUSTICE (Cole's ruling on the 365-deep backlog). The pending queue
// could only ever grow: the knowledge.apply_proposal keyhole fires at
// CREATION time only, so everything filed before the grant sits forever,
// and Bridge notices (briefings, wiki rewrites) never expire. This nightly
// sweep makes the queue self-maintaining, on three rules:
//
//   1. KEYHOLE BACKLOG — pending proposals that were BORN eligible
//      (research/ingestion origin) apply through the exact same granted
//      executor path they'd take today: acted receipt, one-tap undo,
//      trust-ledger attribution. autonomy/persona scopes never auto-apply
//      (hard rule 1), ungranted = untouched, capped per night so receipts
//      trickle instead of flood.
//   2. PROPOSAL EXPIRY — pending proposals older than 30 days expire.
//      A decision Cole hasn't taken in a month is not a decision anymore;
//      it's clutter wearing a badge. Expired ≠ denied: nothing is written,
//      nothing is learned from it.
//   3. SIGNAL EXPIRY — pending/surfaced Bridge signals expire at 14 days
//      when they carry no executable confirm (stale notices), 30 days when
//      they do (stale decisions). "acting" rows are never touched — the
//      boot reaper owns those.
//
// One digest signal reports the sweep's work — counts, not items.

import { prisma } from "../core/db/prisma.ts";

const KEYHOLE_CAP_PER_SWEEP = 25;
const PROPOSAL_EXPIRY_DAYS = 30;
const NOTICE_EXPIRY_DAYS = 14;
const DECISION_EXPIRY_DAYS = 30;

export type QueueSweepResult = {
  applied: number;
  proposalsExpired: number;
  noticesExpired: number;
  decisionsExpired: number;
  missionsArchived: number;
};

const MISSION_ARCHIVE_DAYS = 14;

export async function sweepQueues(): Promise<QueueSweepResult> {
  const now = Date.now();
  const result: QueueSweepResult = { applied: 0, proposalsExpired: 0, noticesExpired: 0, decisionsExpired: 0, missionsArchived: 0 };

  // The keyhole-eligibility predicate, shared by the apply pass AND the
  // expiry exclusion below (post-sweep council: without the exclusion, night
  // one applied 25 and expired the rest of the eligible backlog unapplied —
  // the two policies in one function defeated each other).
  const ELIGIBLE = {
    scope: { notIn: ["autonomy", "persona"] }, // hard rule 1 + one voice
    OR: [
      { origin: { in: ["research", "ingestion"] } },
      // Backlog rows predate the origin column — the research engine's
      // deterministic rationale prefix is the provable marker. Anything
      // unprovable stays for Cole's eyes (or expiry).
      { origin: null as string | null, rationale: { startsWith: "Research-derived from query:" } },
    ],
  };
  let grantLive = false;

  // ── 1. Keyhole backlog — only when Cole's grant is live ──────────────
  try {
    const { decideAction } = await import("../autonomy/grants.ts");
    grantLive = (await decideAction("knowledge.apply_proposal")).finalize;
    if (grantLive) {
      const eligible = await prisma.knowledgeProposal.findMany({
        where: { status: "pending", ...ELIGIBLE },
        orderBy: { createdAt: "asc" },
        take: KEYHOLE_CAP_PER_SWEEP,
      });
      const { executeAction } = await import("../autonomy/executor.ts");
      for (const p of eligible) {
        try {
          const res = await executeAction({
            actionClass: "knowledge.apply_proposal",
            operatorId: p.operatorId,
            sourceType: "reasoning_output",
            sourceId: p.id,
            prepare: async () => ({
              title: `Learned (backlog): ${p.scope}.${p.key}`,
              body:
                `${p.rationale}\n` +
                `Filed: ${JSON.stringify(p.proposedValue).slice(0, 200)}` +
                (p.priorValue !== null && p.priorValue !== undefined
                  ? `\nWas: ${JSON.stringify(p.priorValue).slice(0, 120)}`
                  : ""),
              payload: { proposalId: p.id, operatorId: p.operatorId },
            }),
          });
          if (res.finalized) result.applied++;
        } catch (err) {
          // "claim lost" = someone else resolved it (fine, no receipt filed);
          // a receipt-write failure means it APPLIED without a receipt — the
          // executor already logged the reconstruction payload.
          console.warn(`[queueSweep] backlog apply for ${p.id} did not complete cleanly:`, (err as any)?.message ?? err);
        }
      }
    }
  } catch (err) {
    console.warn("[queueSweep] keyhole backlog pass failed (non-fatal):", (err as any)?.message ?? err);
  }

  // ── 2. Proposal expiry ───────────────────────────────────────────────
  // While the grant is live, keyhole-eligible rows are EXCLUDED from expiry:
  // they're queued for the 25/night trickle, not clutter. Grant revoked →
  // they age out like everything else.
  try {
    const cutoff = new Date(now - PROPOSAL_EXPIRY_DAYS * 86400_000);
    const expired = await prisma.knowledgeProposal.updateMany({
      where: {
        status: "pending",
        createdAt: { lt: cutoff },
        ...(grantLive ? { NOT: ELIGIBLE } : {}),
      },
      data: { status: "expired", resolvedAt: new Date() },
    });
    result.proposalsExpired = expired.count;
  } catch (err) {
    console.warn("[queueSweep] proposal expiry failed (non-fatal):", (err as any)?.message ?? err);
  }

  // ── 3. Signal expiry ─────────────────────────────────────────────────
  try {
    const stale = await prisma.bridgeSignal.findMany({
      where: {
        status: { in: ["pending", "surfaced"] },
        // Critical never auto-expires (post-sweep council): the boot reaper's
        // "may have already shipped — verify before re-confirming" warnings
        // must outlive any clock; only Cole closes those.
        severity: { not: "critical" },
        createdAt: { lt: new Date(now - NOTICE_EXPIRY_DAYS * 86400_000) },
      },
      select: { id: true, createdAt: true, actions: true },
    });
    const noticeIds: string[] = [];
    const decisionIds: string[] = [];
    const decisionCutoff = now - DECISION_EXPIRY_DAYS * 86400_000;
    for (const s of stale) {
      const executable = ((s.actions as any[]) ?? []).some((a) => a?.action === "confirm_action");
      if (!executable) noticeIds.push(s.id);
      else if (s.createdAt.getTime() < decisionCutoff) decisionIds.push(s.id);
    }
    if (noticeIds.length > 0) {
      const r = await prisma.bridgeSignal.updateMany({
        where: { id: { in: noticeIds }, status: { in: ["pending", "surfaced"] } },
        data: { status: "expired" },
      });
      result.noticesExpired = r.count;
    }
    if (decisionIds.length > 0) {
      const r = await prisma.bridgeSignal.updateMany({
        where: { id: { in: decisionIds }, status: { in: ["pending", "surfaced"] } },
        data: { status: "expired" },
      });
      result.decisionsExpired = r.count;
    }
  } catch (err) {
    console.warn("[queueSweep] signal expiry failed (non-fatal):", (err as any)?.message ?? err);
  }

  // ── 4. Ignored-mission archive (alignment council: an ignored proposal
  // used to silence its own topic FOREVER — alreadyInFlight blocked
  // re-proposal while the mission sat "proposed" and nothing ever moved it).
  // After the Sunday second-look window, archive it: the topic may
  // re-propose when conditions persist, and the archive is honest history,
  // not a denial. ──────────────────────────────────────────────────────
  try {
    const archived = await prisma.mission.updateMany({
      where: { status: "proposed", createdAt: { lt: new Date(now - MISSION_ARCHIVE_DAYS * 86400_000) } },
      data: { status: "archived" },
    });
    result.missionsArchived = archived.count;
  } catch (err) {
    console.warn("[queueSweep] mission archive failed (non-fatal):", (err as any)?.message ?? err);
  }

  // ── Digest — one line of receipts, only when work happened ───────────
  const total = result.applied + result.proposalsExpired + result.noticesExpired + result.decisionsExpired + result.missionsArchived;
  if (total > 0) {
    try {
      await prisma.bridgeSignal.create({
        data: {
          kind: "background_result",
          domain: "personal",
          sourceType: "queue_sweep",
          severity: "info",
          // A receipt, not a decision: pre-acknowledged so the clutter
          // sweep's own digest never inflates the needs-you bell it exists
          // to protect (post-sweep council). It stays on the record.
          status: "acknowledged",
          title: `Queue swept: ${result.applied} applied under your grant · ${result.proposalsExpired + result.noticesExpired + result.decisionsExpired} expired`,
          body:
            `${result.applied} eligible proposal(s) auto-applied through the knowledge keyhole (receipts + undo on the Bridge).\n` +
            `${result.proposalsExpired} proposal(s) expired at ${PROPOSAL_EXPIRY_DAYS} days unanswered.\n` +
            `${result.noticesExpired} stale notice(s) cleared at ${NOTICE_EXPIRY_DAYS} days.\n` +
            (result.decisionsExpired > 0
              ? `${result.decisionsExpired} unanswered decision(s) expired at ${DECISION_EXPIRY_DAYS} days — nothing was executed.\n`
              : "") +
            (result.missionsArchived > 0
              ? `${result.missionsArchived} unanswered mission proposal(s) archived at ${MISSION_ARCHIVE_DAYS} days — their topics may resurface if conditions persist.`
              : ""),
        },
      });
    } catch (err) {
      console.warn("[queueSweep] digest signal failed (non-fatal):", (err as any)?.message ?? err);
    }
  }

  console.log(
    `[queueSweep] applied ${result.applied} · expired ${result.proposalsExpired} proposals, ${result.noticesExpired} notices, ${result.decisionsExpired} decisions · archived ${result.missionsArchived} missions`
  );
  return result;
}
