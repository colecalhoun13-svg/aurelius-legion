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
  "task",
  "corpus_doc",
  "wiki_page",
];

// Below this similarity the hit is noise, not recall. Tuned for
// text-embedding-3-small; revisit when the embedding model changes.
const MIN_SIMILARITY = 0.25;

// Reranking (master-class #3). Raw cosine at MIN_SIMILARITY floods the prompt with
// weak, stale, duplicate hits once the corpus grows. We fetch WIDER than we'll
// return, then rerank deterministically (no per-prompt LLM call on the hot path)
// by blending cosine with RECENCY and a small SOURCE-AUTHORITY prior, dedup
// near-identical chunks, and cut. Similarity stays the noise floor so recency can
// never promote true noise.
const FETCH_WIDTH = 24;               // retrieve wide, then rerank down
const RECENCY_WEIGHT = 0.12;          // small — cosine still dominates
const RECENCY_HALFLIFE_DAYS = 45;
// Curated/confirmed sources outrank raw notes on a tie.
const SOURCE_PRIOR: Record<string, number> = {
  knowledge_entry: 0.06,
  wiki_page: 0.05,
  corpus_doc: 0.02,
  reasoning_cache: 0.02,
};

function recencyScore(createdAt?: Date): number {
  if (!createdAt) return 0;
  const ageDays = (Date.now() - createdAt.getTime()) / 86_400_000;
  if (ageDays <= 0) return 1;
  return Math.exp(-ageDays / RECENCY_HALFLIFE_DAYS); // 1 today → e⁻¹ at half-life
}

function dedupKey(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim().slice(0, 160);
}

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

    const limit = args.limit ?? 8;
    const hits = await searchSimilar({
      embedding: queryVec,
      limit: Math.max(FETCH_WIDTH, limit), // widen so rerank has candidates
      sourceTypes: args.sourceTypes ?? DEFAULT_SOURCES,
      operatorId: args.operatorId,
      // Only match rows embedded by the SAME model as this query — mixed
      // geometries (e.g. leftover OpenAI vectors after a Gemini switch) would
      // otherwise surface as confident garbage. Must match the exact string
      // the write path stores in embedPipeline.ts: `${name}:${model}`.
      embeddingModel: `${adapter.name}:${adapter.model}`,
    });

    // Similarity floor first — recency/authority must never rescue pure noise.
    const eligible = hits.filter((h) => h.similarity >= MIN_SIMILARITY);

    // Blend, then sort by the blended score.
    const scored = eligible
      .map((h) => ({
        h,
        blended: h.similarity + RECENCY_WEIGHT * recencyScore(h.createdAt) + (SOURCE_PRIOR[h.sourceType] ?? 0),
      }))
      .sort((a, b) => b.blended - a.blended);

    // Dedup near-identical chunk text (same content re-ingested, or one doc's
    // adjacent overlapping chunks) — keep the highest-ranked instance.
    const seen = new Set<string>();
    const out: SimilarChunk[] = [];
    for (const s of scored) {
      const key = dedupKey(s.h.chunkText);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(s.h);
      if (out.length >= limit) break;
    }
    return out;
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
