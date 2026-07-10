// aurelius/retrieval/retrieve.ts
//
// Phase 4.6 — Read-side of the retrieval substrate (Layer 5.5).
//
// semanticRecall() embeds the user's message and pulls the closest chunks
// across knowledge, memory, and cached reasoning. The router injects the
// formatted block into the prompt between memory (Layer 5) and tools
// (Layer 6). Failure here must never break prompt assembly — callers get
// an empty array/string instead of an exception.

import { getEmbeddingAdapter } from "./embeddingAdapter.ts";
import {
  searchSimilar,
  type SimilarChunk,
  type EmbeddingSourceType,
} from "./vectorStore.ts";

const DEFAULT_SOURCES: EmbeddingSourceType[] = [
  "knowledge_entry",
  "memory",
  "reasoning_cache",
  "note",
  "corpus_doc",
];

// Below this similarity the hit is noise, not recall. Tuned for
// text-embedding-3-small; revisit when the embedding model changes.
const MIN_SIMILARITY = 0.25;

export async function semanticRecall(args: {
  query: string;
  operatorId?: string;
  limit?: number;
  sourceTypes?: EmbeddingSourceType[];
}): Promise<SimilarChunk[]> {
  try {
    const adapter = getEmbeddingAdapter();
    if (!adapter) return [];
    if (!args.query || args.query.trim().length === 0) return [];

    const [queryVec] = await adapter.embed([args.query.slice(0, 6000)]);
    if (!queryVec) return [];

    const hits = await searchSimilar({
      embedding: queryVec,
      limit: args.limit ?? 8,
      sourceTypes: args.sourceTypes ?? DEFAULT_SOURCES,
      operatorId: args.operatorId,
    });

    return hits.filter((h) => h.similarity >= MIN_SIMILARITY);
  } catch (err) {
    console.warn("[retrieve] semantic recall failed (non-fatal):", err);
    return [];
  }
}

const SOURCE_LABELS: Record<string, string> = {
  knowledge_entry: "knowledge",
  memory: "memory",
  reasoning_cache: "prior reasoning",
  note: "note",
  corpus_doc: "document",
};

/**
 * Format recall hits as a prompt block. Empty string when nothing
 * surfaced — the router skips the layer entirely.
 */
export function formatRecallForPrompt(hits: SimilarChunk[]): string {
  if (hits.length === 0) return "";

  const lines: string[] = [
    "═══ SEMANTIC RECALL (retrieved because it's relevant to this message) ═══",
    "Ground your answer in these when they apply. Don't cite them mechanically.",
    "",
  ];
  for (const h of hits) {
    const label = SOURCE_LABELS[h.sourceType] ?? h.sourceType;
    const pct = Math.round(h.similarity * 100);
    lines.push(`[${label} · ${pct}%] ${h.chunkText}`);
  }
  return lines.join("\n");
}
