// aurelius/compiled/types.ts
//
// Phase 4.5 — Compiled Understanding type definitions.
// Domain-agnostic. Engine doesn't care whether it's compiling training
// sessions, voice patterns, or business leads — only the domain string differs.

export type ReasoningCacheEntryShape = {
  id: string;
  operatorId: string;
  domain: string;
  entityKey: string;
  externalScopeId: string;
  subContext: string | null;
  situationSignature: any;
  reasoningSummary: string;
  sourceMemoryIds: string[];
  usageCount: number;
  previousTags: any[];
  createdAt: Date;
  updatedAt: Date;
};

export type CompiledPatternShape = {
  id: string;
  operatorId: string;
  domain: string;
  entityKey: string | null;
  externalScopeId: string | null;
  patternType: PatternType;
  patternSignature: any;
  conditions: any | null;
  status: PatternStatus;
  evidence: string[];
  supportCount: number;
  confidenceScore: number;
  createdAt: Date;
  updatedAt: Date;
};

export type PatternType = "factual" | "heuristic" | "structuralMatch";

export type PatternStatus =
  | "auto_factual"
  | "proposed_heuristic"
  | "confirmed_heuristic"
  | "discarded";

// Each operator implements its own signature builder for its domain.
export type TaggedSignature = {
  tags: Record<string, any>;        // structured tags from operator's knowledge module
  fingerprint: string;              // stable string for fast cache lookup
  raw: any;                         // raw input the signature was built from
};

export type SignatureBuilderFn<TInput = any> = (
  input: TInput
) => Promise<TaggedSignature> | TaggedSignature;

export type CacheLookupArgs = {
  operatorId: string;
  domain: string;
  entityKey: string;
  externalScopeId?: string;
  signature: TaggedSignature;
  similarityThreshold?: number;     // 0-1, default 0.85
};

export type CacheWriteArgs = {
  operatorId: string;
  domain: string;
  entityKey: string;
  externalScopeId: string;
  subContext?: string;
  signature: TaggedSignature;
  reasoningSummary: string;
  sourceMemoryIds?: string[];
};

export type PatternDetectionArgs = {
  operatorId: string;
  domain: string;
  entityKey: string;
  signature: TaggedSignature;
  factualThreshold?: number;        // default 2 — facts auto-compile
  heuristicThreshold?: number;      // default 3 — heuristics propose
};

export type PatternProposal = {
  patternType: PatternType;
  patternSignature: any;
  evidenceIds: string[];
  supportCount: number;
  confidenceScore: number;
  rationale: string;
};
