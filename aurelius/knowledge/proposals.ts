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
import { isAutoApproved } from "./escalation.ts";
import type { KnowledgeSourceType } from "./types.ts";
import type { TaggedSignature } from "../compiled/types.ts";

export type ProposalStatus =
  | "pending"
  | "confirmed"
  | "denied"
  | "corrected";

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

  // Escalation matrix: if Cole granted standing auto-apply for this
  // operator × intent class, resolve immediately — and surface it on
  // the Bridge. Authorized automation is never silent.
  try {
    if (await isAutoApproved(input.operatorId, input.intentClassId, input.scope)) {
      const resolved = await resolveProposal({
        operatorId: input.operatorId,
        proposalId: proposal.id,
        decision: "confirmed",
        coleResponseText: "auto-applied per standing escalation opt-in",
      });
      await prisma.bridgeSignal.create({
        data: {
          kind: "background_result",
          domain: "personal",
          sourceType: "reasoning_output",
          sourceId: proposal.id,
          severity: "notice",
          title: `Auto-applied: ${input.scope}.${input.key} (${input.intentClassId})`,
          body: `Standing opt-in for ${input.operatorName} × ${input.intentClassId}.\nApplied: ${JSON.stringify(input.proposedValue).slice(0, 200)}\nRevoke anytime: clear autonomy.auto_apply_intents.`,
        },
      });
      return resolved ?? proposal;
    }
  } catch (err) {
    console.error("[proposals] escalation check failed — staying pending:", err);
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
        sourceType: "cole_conversation" as KnowledgeSourceType,
        sourceId: proposal.id,
        rationale: `${input.decision === "corrected" ? "Corrected" : "Confirmed"} from: "${proposal.coleNaturalLanguage}" → "${input.coleResponseText}"`,
        updatedBy: "cole",
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
