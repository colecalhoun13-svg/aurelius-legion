// aurelius/knowledge/proposals.ts
//
// Phase 4.5 — Knowledge update proposal lifecycle.
//
// Flow:
//   1. LLM emits [KNOWLEDGE_UPDATE_PROPOSE: ...]
//   2. Chat endpoint calls createProposal() → status="pending"
//   3. Proposal logged to ReasoningCacheEntry (domain="taxonomy_update")
//      for voice compilation
//   4. Cole responds with natural language (or explicit confirm)
//   5. Next turn's LLM emits [KNOWLEDGE_UPDATE_CONFIRM: ...]
//   6. Chat endpoint calls resolveProposal() → applies or discards
//   7. Resolution logged to cache
//
// Pending proposals live in-memory (ephemeral, per operator).
// Resolutions persist to KnowledgeEntry + ReasoningCacheEntry.

import { setKnowledge, getKnowledge } from "./store.ts";
import { writeCache } from "../compiled/cache.ts";
import { getIntentClass } from "./intentClasses.ts";
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

const pendingProposals = new Map<string, KnowledgeProposal[]>();

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

  const proposal: KnowledgeProposal = {
    id: `prop_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    operatorId: input.operatorId,
    operatorName: input.operatorName,
    intentClassId: input.intentClassId,
    scope: input.scope,
    key: input.key,
    proposedValue: input.proposedValue,
    priorValue,
    rationale: input.rationale,
    coleNaturalLanguage: input.coleNaturalLanguage,
    status: "pending",
    createdAt: new Date(),
    resolvedAt: null,
    cacheEntryId: null,
  };

  const existingProposals = pendingProposals.get(input.operatorId) ?? [];
  existingProposals.push(proposal);
  pendingProposals.set(input.operatorId, existingProposals);

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
    proposal.cacheEntryId = cacheEntry.id;
  } catch (err) {
    console.error("[proposals] failed to log proposal to cache (non-fatal):", err);
  }

  return proposal;
}

export function getPendingProposals(operatorId: string): KnowledgeProposal[] {
  return (pendingProposals.get(operatorId) ?? []).filter(
    (p) => p.status === "pending"
  );
}

export function getProposalById(
  operatorId: string,
  proposalId: string
): KnowledgeProposal | null {
  return (
    (pendingProposals.get(operatorId) ?? []).find(
      (p) => p.id === proposalId
    ) ?? null
  );
}

/**
 * Format pending proposals for LLM prompt (Layer 7.5).
 * LLM sees what's in flight so it can detect natural confirmation/denial.
 */
export function formatPendingProposalsForPrompt(operatorId: string): string {
  const pending = getPendingProposals(operatorId);
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
  const proposal = getProposalById(input.operatorId, input.proposalId);
  if (!proposal) {
    console.warn(`[proposals] resolve called for unknown proposal: ${input.proposalId}`);
    return null;
  }
  if (proposal.status !== "pending") {
    console.warn(`[proposals] proposal ${input.proposalId} already ${proposal.status}`);
    return proposal;
  }

  proposal.status = input.decision;
  proposal.resolvedAt = new Date();

  const valueToApply =
    input.decision === "corrected" ? input.correctedValue : proposal.proposedValue;

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
      throw err;
    }
  }

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
 * Cleanup for stale pending proposals. v1 no-op.
 */
export function expireOldProposals(
  _operatorId: string,
  _maxAgeMs: number = 1000 * 60 * 30
): number {
  return 0;
}
