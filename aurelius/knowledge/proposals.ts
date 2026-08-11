// aurelius/knowledge/proposals.ts
//
// Phase 4.5 — Knowledge update proposal lifecycle. DURABLE.
//
// Flow:
//   1. LLM emits [KNOWLEDGE_UPDATE_PROPOSE: ...]
//   2. Chat endpoint calls createProposal() → status="pending" (persisted)
//   3. Proposal logged to ReasoningCacheEntry (domain="taxonomy_update")
//      for voice compilation
//   4. Cole responds — in chat (natural language → next turn's LLM emits
//      [KNOWLEDGE_UPDATE_CONFIRM: ...]) or on the Bridge review surface
//   5. resolveProposal() applies or discards; resolution logged to cache
//
// v1 kept pending proposals in an in-memory Map — they died on restart,
// which made the learning loop untrustworthy. Now every proposal lives in
// Postgres until Cole resolves it.

import { prisma } from "../core/db/prisma.ts";
import { setKnowledge, getKnowledge } from "./store.ts";
import { writeCache } from "../compiled/cache.ts";
import { getIntentClass } from "./intentClasses.ts";
import type { KnowledgeSourceType } from "./types.ts";
import type { TaggedSignature } from "../compiled/types.ts";

// Scope that never auto-applies, no matter what's granted (hard rule 1).
const ESCALATION_SCOPE = "autonomy";

/**
 * Scopes that NEVER auto-apply under the knowledge.apply_proposal keyhole, no
 * matter what's granted or where the proposal was born. ONE definition, used by
 * every guard (createProposal's inline apply, the queue sweep's eligibility, and
 * the resolveProposal choke point) so they can't drift apart again:
 *   - "autonomy": hard rule 1 — autonomy never escalates its own autonomy.
 *   - "persona":  one voice — the voice is never rewritten without Cole.
 *   - "system":   rule 6 — operational/mirror cursors are never model-writable,
 *                 and (store.ts) never embedded into the vector index. A research
 *                 synthesis consumes external web/corpus text, so without this an
 *                 injected source could steer an LLM-emitted scope:"system" into
 *                 an auto-applied write (verified reachable, 2026-08-11 council).
 */
export const NON_KEYHOLE_SCOPES = ["autonomy", "persona", "system"] as const;

/** Origins the ingestion keyhole may auto-apply from. Anything else keeps Cole's
 *  confirm loop (his own words, his voice, re-anchoring stale truth). */
export const KEYHOLE_ORIGINS = ["research", "ingestion"] as const;

/** Where a proposal was born — decides whether the ingestion keyhole applies. */
export type ProposalOrigin = "chat" | "research" | "ingestion" | "observer" | "freshness";

export type ProposalStatus =
  | "pending"
  | "confirmed"
  | "denied"
  | "corrected"
  | "expired"; // 30 days unanswered → the nightly queue sweep retires it

export type KnowledgeProposal = {
  id: string;
  operatorId: string;
  operatorName: string;
  intentClassId: string;
  scope: string;
  key: string;
  proposedValue: any;
  priorValue: any | null;
  rationale: string;
  coleNaturalLanguage: string;
  status: ProposalStatus;
  createdAt: Date;
  resolvedAt: Date | null;
  cacheEntryId: string | null;
  origin: string | null; // carried so the resolve choke point can re-derive it
};

function fromRow(row: any): KnowledgeProposal {
  return {
    id: row.id,
    operatorId: row.operatorId,
    operatorName: row.operatorName,
    intentClassId: row.intentClassId,
    scope: row.scope,
    key: row.key,
    proposedValue: row.proposedValue,
    priorValue: row.priorValue ?? null,
    rationale: row.rationale,
    coleNaturalLanguage: row.coleNaturalLanguage,
    status: row.status as ProposalStatus,
    createdAt: row.createdAt,
    resolvedAt: row.resolvedAt,
    cacheEntryId: row.cacheEntryId,
    origin: row.origin ?? null,
  };
}

export type CreateProposalInput = {
  operatorId: string;
  operatorName: string;
  intentClassId: string;
  scope: string;
  key: string;
  proposedValue: any;
  rationale: string;
  coleNaturalLanguage: string;
  origin?: ProposalOrigin;
};

export async function createProposal(
  input: CreateProposalInput
): Promise<KnowledgeProposal> {
  const intentClass = getIntentClass(input.intentClassId);
  if (!intentClass) {
    throw new Error(`Unknown intent class: ${input.intentClassId}`);
  }

  const existing = await getKnowledge(input.operatorId, input.scope, input.key, {
    includeInactive: true,
  });
  const priorValue = existing?.value ?? null;

  const row = await prisma.knowledgeProposal.create({
    data: {
      operatorId: input.operatorId,
      operatorName: input.operatorName,
      intentClassId: input.intentClassId,
      scope: input.scope,
      key: input.key,
      proposedValue: input.proposedValue,
      priorValue: priorValue ?? undefined,
      rationale: input.rationale,
      coleNaturalLanguage: input.coleNaturalLanguage,
      // Persisted so the nightly queue sweep can prove keyhole eligibility
      // for rows the grant wasn't live to catch at creation time.
      origin: input.origin ?? null,
    },
  });

  // Log to cache for voice compilation
  const proposalSignature: TaggedSignature = {
    tags: {
      intentClass: input.intentClassId,
      scope: input.scope,
      key: input.key,
      stage: "proposal",
    },
    fingerprint: `proposal:${input.intentClassId}:${input.scope}:${input.key}`,
    raw: { coleNaturalLanguage: input.coleNaturalLanguage },
  };

  let cacheEntryId: string | null = null;
  try {
    const cacheEntry = await writeCache({
      operatorId: input.operatorId,
      domain: "taxonomy_update",
      entityKey: "cole",
      externalScopeId: "voice",
      subContext: input.intentClassId,
      signature: proposalSignature,
      reasoningSummary: `Proposal: ${input.coleNaturalLanguage} → ${input.scope}.${input.key} = ${JSON.stringify(input.proposedValue).slice(0, 120)}`,
      sourceMemoryIds: [],
    });
    cacheEntryId = cacheEntry.id;
    await prisma.knowledgeProposal.update({
      where: { id: row.id },
      data: { cacheEntryId },
    });
  } catch (err) {
    console.error("[proposals] failed to log proposal to cache (non-fatal):", err);
  }

  const proposal = fromRow({ ...row, cacheEntryId });

  // (The legacy per-intent escalation matrix that auto-applied here was
  // removed on the check-in council's ruling: it bypassed the executor —
  // no receipt with undo, no trust-ledger attribution, and no persona
  // guard. The ONE auto-apply path is now the keyhole below, which has
  // all three by construction.)

  // THE INGESTION KEYHOLE (Cole's ruling: the per-item confirm chore was "too
  // involved"). Research/ingestion-born proposals may FINALIZE under the
  // granted inward class `knowledge.apply_proposal` — through the executor, so
  // every write lands as an acted receipt with a one-tap Undo that restores
  // the prior value. Guards by construction: chat/observer/freshness proposals
  // keep the confirm loop (Cole's own words, his voice, and re-anchoring stale
  // truth all deserve his eyes), and the autonomy (hard rule 1) and persona
  // (one voice) scopes never auto-apply no matter what's granted.
  try {
    const fromIngestion = input.origin === "research" || input.origin === "ingestion";
    if (fromIngestion && !(NON_KEYHOLE_SCOPES as readonly string[]).includes(input.scope)) {
      const { decideAction } = await import("../autonomy/grants.ts");
      if ((await decideAction("knowledge.apply_proposal")).finalize) {
        const { executeAction } = await import("../autonomy/executor.ts");
        const res = await executeAction({
          actionClass: "knowledge.apply_proposal",
          operatorId: input.operatorId,
          sourceType: "reasoning_output",
          sourceId: proposal.id,
          prepare: async () => ({
            title: `Learned: ${input.scope}.${input.key}`,
            body:
              `${input.rationale}\n` +
              `Filed: ${JSON.stringify(input.proposedValue).slice(0, 200)}` +
              (priorValue !== null ? `\nWas: ${JSON.stringify(priorValue).slice(0, 120)}` : ""),
            payload: { proposalId: proposal.id, operatorId: input.operatorId },
          }),
        });
        if (res.finalized) {
          return (await getProposalById(input.operatorId, proposal.id)) ?? proposal;
        }
      }
    }
  } catch (err) {
    console.error("[proposals] ingestion keyhole failed — staying pending:", err);
  }

  return proposal;
}

export async function getPendingProposals(
  operatorId: string
): Promise<KnowledgeProposal[]> {
  const rows = await prisma.knowledgeProposal.findMany({
    where: { operatorId, status: "pending" },
    orderBy: { createdAt: "asc" },
  });
  return rows.map(fromRow);
}

/** Every pending proposal across all operators — the Bridge review surface. */
export async function getAllPendingProposals(): Promise<KnowledgeProposal[]> {
  const rows = await prisma.knowledgeProposal.findMany({
    where: { status: "pending" },
    orderBy: { createdAt: "asc" },
  });
  return rows.map(fromRow);
}

export async function getProposalById(
  operatorId: string,
  proposalId: string
): Promise<KnowledgeProposal | null> {
  const row = await prisma.knowledgeProposal.findFirst({
    where: { id: proposalId, operatorId },
  });
  return row ? fromRow(row) : null;
}

/**
 * Format pending proposals for LLM prompt (Layer 7.5).
 * LLM sees what's in flight so it can detect natural confirmation/denial.
 */
export async function formatPendingProposalsForPrompt(
  operatorId: string
): Promise<string> {
  const pending = await getPendingProposals(operatorId);
  if (pending.length === 0) return "";

  const lines: string[] = [
    "═══ PENDING KNOWLEDGE UPDATE PROPOSALS ═══",
    "These proposals await Cole's confirmation. If his next message confirms, denies, or corrects any of them, emit a [KNOWLEDGE_UPDATE_CONFIRM:] directive.",
    "",
  ];
  for (const p of pending) {
    lines.push(`Proposal ${p.id}:`);
    lines.push(`  Intent: ${p.intentClassId}`);
    lines.push(`  Scope: ${p.scope}.${p.key}`);
    if (p.priorValue !== null) {
      lines.push(`  Prior: ${JSON.stringify(p.priorValue).slice(0, 120)}`);
    }
    lines.push(`  Proposed: ${JSON.stringify(p.proposedValue).slice(0, 120)}`);
    lines.push(`  Cole's original phrasing: "${p.coleNaturalLanguage}"`);
    lines.push("");
  }
  return lines.join("\n");
}

export type ResolveProposalInput = {
  operatorId: string;
  proposalId: string;
  decision: "confirmed" | "denied" | "corrected";
  coleResponseText: string;
  correctedValue?: any;
  // Honest provenance for the keyhole path: an auto-filed write is
  // research_ingestion by aurelius, never dressed up as Cole's conversation.
  sourceType?: KnowledgeSourceType;
  updatedBy?: string;
};

export async function resolveProposal(
  input: ResolveProposalInput
): Promise<KnowledgeProposal | null> {
  const proposal = await getProposalById(input.operatorId, input.proposalId);
  if (!proposal) {
    console.warn(`[proposals] resolve called for unknown proposal: ${input.proposalId}`);
    return null;
  }
  if (proposal.status !== "pending") {
    console.warn(`[proposals] proposal ${input.proposalId} already ${proposal.status}`);
    return proposal;
  }

  // THE CHOKE-POINT CONSTITUTION GUARD (2026-08-11 council, verified reachable
  // by live PoC). The keyhole's invariants used to live ONLY in the callers
  // (createProposal's inline apply, the queue sweep). This is the one place
  // every auto-apply passes through, so it enforces them here — a future caller,
  // refactor, or injection-steered payload can no longer slip a forbidden scope
  // or origin past the grant. Only the machine's own auto-apply is gated; Cole's
  // hand (updatedBy defaulting to "cole") confirms anything he can see.
  if (input.updatedBy === "aurelius" && (input.decision === "confirmed" || input.decision === "corrected")) {
    if ((NON_KEYHOLE_SCOPES as readonly string[]).includes(proposal.scope)) {
      throw new Error(
        `keyhole refused: scope "${proposal.scope}" never auto-applies (proposal ${proposal.id}) — it needs Cole's confirm`
      );
    }
    if (!proposal.origin || !(KEYHOLE_ORIGINS as readonly string[]).includes(proposal.origin)) {
      throw new Error(
        `keyhole refused: origin "${proposal.origin ?? "none"}" is not research/ingestion (proposal ${proposal.id}) — it needs Cole's confirm`
      );
    }
  }

  const valueToApply =
    input.decision === "corrected" ? input.correctedValue : proposal.proposedValue;

  // ATOMIC CLAIM before applying. The check above (status === pending) races: a
  // Bridge confirm and a chat [KNOWLEDGE_UPDATE_CONFIRM] can both pass it, then
  // both apply — double-writing knowledge, or one confirming a value the other
  // denied. Flip pending → decision in a single guarded updateMany; only the
  // winner (count 1) proceeds to apply. If applying then fails, revert the claim
  // so Cole can retry.
  const resolvedAt = new Date();
  const claim = await prisma.knowledgeProposal.updateMany({
    where: { id: proposal.id, status: "pending" },
    data: { status: input.decision, resolvedAt },
  });
  if (claim.count === 0) {
    const fresh = await getProposalById(input.operatorId, input.proposalId);
    console.warn(`[proposals] proposal ${input.proposalId} resolved by a concurrent turn`);
    return fresh;
  }

  if (input.decision === "confirmed" || input.decision === "corrected") {
    try {
      await setKnowledge({
        operatorId: proposal.operatorId,
        scope: proposal.scope,
        key: proposal.key,
        value: valueToApply,
        sourceType: input.sourceType ?? ("cole_conversation" as KnowledgeSourceType),
        sourceId: proposal.id,
        rationale: `${input.decision === "corrected" ? "Corrected" : "Confirmed"} from: "${proposal.coleNaturalLanguage}" → "${input.coleResponseText}"`,
        updatedBy: input.updatedBy ?? "cole",
      });
    } catch (err) {
      console.error(`[proposals] failed to apply ${input.decision}:`, err);
      // Release the claim so the confirm can be retried — nothing was applied.
      await prisma.knowledgeProposal
        .updateMany({ where: { id: proposal.id, status: input.decision }, data: { status: "pending", resolvedAt: null } })
        .catch(() => {});
      throw err;
    }
  }

  proposal.status = input.decision;
  proposal.resolvedAt = resolvedAt;
  // Winner marker (post-sweep council): the atomic claim's LOSER gets the
  // fresh row back without this flag — callers that must not double-file
  // receipts (the keyhole finalizer) check it instead of guessing by status
  // (two concurrent confirms would both read "confirmed").
  (proposal as any).claimWon = true;

  // Log resolution to cache
  const resolutionSignature: TaggedSignature = {
    tags: {
      intentClass: proposal.intentClassId,
      scope: proposal.scope,
      key: proposal.key,
      decision: input.decision,
      stage: "resolution",
    },
    fingerprint: `resolution:${proposal.intentClassId}:${input.decision}`,
    raw: {
      coleProposalPhrasing: proposal.coleNaturalLanguage,
      coleResponsePhrasing: input.coleResponseText,
    },
  };

  try {
    await writeCache({
      operatorId: proposal.operatorId,
      domain: "taxonomy_update",
      entityKey: "cole",
      externalScopeId: "voice",
      subContext: proposal.intentClassId,
      signature: resolutionSignature,
      reasoningSummary: `Resolution: Cole ${input.decision} proposal "${proposal.coleNaturalLanguage}" via "${input.coleResponseText}"`,
      sourceMemoryIds: proposal.cacheEntryId ? [proposal.cacheEntryId] : [],
    });
  } catch (err) {
    console.error("[proposals] failed to log resolution to cache (non-fatal):", err);
  }

  return proposal;
}

/**
 * The keyhole's one-tap Undo (registered as knowledge.apply_proposal's inverse):
 * restore the prior value if there was one, deactivate the entry the auto-apply
 * created otherwise, and mark the proposal denied so nothing re-applies it.
 */
export async function undoAppliedProposal(
  operatorId: string,
  proposalId: string
): Promise<{ restored: boolean; detail: string }> {
  const p = await getProposalById(operatorId, proposalId);
  if (!p) return { restored: false, detail: "proposal not found" };

  if (p.priorValue !== null) {
    await setKnowledge({
      operatorId: p.operatorId,
      scope: p.scope,
      key: p.key,
      value: p.priorValue,
      sourceType: "cole_correction" as KnowledgeSourceType,
      sourceId: p.id,
      rationale: `Undo: Cole reversed the auto-filed proposal — prior value restored`,
      updatedBy: "cole",
    });
  } else {
    await prisma.knowledgeEntry.updateMany({
      where: { operatorId: p.operatorId, scope: p.scope, key: p.key, active: true },
      data: { active: false, updatedBy: "cole" },
    });
  }

  await prisma.knowledgeProposal.updateMany({
    where: { id: p.id },
    data: { status: "denied" },
  });

  return {
    restored: true,
    detail: p.priorValue !== null ? "prior value restored" : "entry deactivated",
  };
}
