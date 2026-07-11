// aurelius/knowledge/types.ts
//
// Phase 4.5a — Living Knowledge type definitions.
// Mirrors the Prisma KnowledgeEntry model with a friendlier shape
// for callers, plus types for updates with provenance.

export type KnowledgeSourceType =
  | "founding_default"
  | "cole_conversation"
  | "cole_correction"
  | "research_ingestion"
  | "system"
  | "manual";

export type KnowledgeEntryShape = {
  id: string;
  operatorId: string;
  scope: string;          // e.g., "rep_bands"
  key: string;            // e.g., "strength"
  value: any;             // structured payload (Json in DB)
  sourceType: KnowledgeSourceType;
  sourceId?: string | null;
  rationale?: string | null;
  createdBy: string;
  updatedBy?: string | null;
  version: number;
  active: boolean;
  history: any[];
  createdAt: Date;
  updatedAt: Date;
};

export type KnowledgeUpdateInput = {
  operatorId: string;
  scope: string;
  key: string;
  value: any;
  sourceType: KnowledgeSourceType;
  sourceId?: string;
  rationale?: string;
  updatedBy: string;        // "cole" | "system" | "research" | etc.
};

export type KnowledgeQueryInput = {
  operatorId: string;
  scope?: string;
  key?: string;
  activeOnly?: boolean;     // default true
};

// History entry stored inside the `history` Json[] field
export type KnowledgeHistoryEntry = {
  value: any;
  sourceType: KnowledgeSourceType;
  sourceId: string | null;
  rationale: string | null;
  version: number;
  replacedAt: string;       // ISO timestamp
  replacedBy: string;       // who triggered the replacement
};