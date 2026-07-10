// aurelius/retrieval/embedPipeline.ts
//
// Phase 4.6 — Write-side of the retrieval substrate.
//
// embedSourceSafe() is the only entry point other subsystems call. It is
// deliberately FIRE-AND-FORGET SAFE: any failure (no API key, provider
// down, DB hiccup) logs and returns — a memory save or knowledge write
// must NEVER fail because the index couldn't update. Backfill sweeps up
// anything missed.

import { getEmbeddingAdapter } from "./embeddingAdapter.ts";
import { upsertEmbedding, type EmbeddingSourceType } from "./vectorStore.ts";

export type EmbedSourceArgs = {
  sourceType: EmbeddingSourceType;
  sourceId: string;
  text: string;
  operatorId?: string | null;
  domain?: string | null;
};

// Simple chunking: most Aurelius artifacts (memories, knowledge values,
// reasoning summaries) are short. Long text splits at ~1600 chars with
// 200-char overlap, breaking on whitespace where possible.
const CHUNK_SIZE = 1600;
const CHUNK_OVERLAP = 200;

export function chunkText(text: string): string[] {
  const trimmed = text.trim();
  if (trimmed.length <= CHUNK_SIZE) return trimmed.length > 0 ? [trimmed] : [];

  const chunks: string[] = [];
  let start = 0;
  while (start < trimmed.length) {
    let end = Math.min(start + CHUNK_SIZE, trimmed.length);
    if (end < trimmed.length) {
      const lastSpace = trimmed.lastIndexOf(" ", end);
      if (lastSpace > start + CHUNK_SIZE / 2) end = lastSpace;
    }
    chunks.push(trimmed.slice(start, end).trim());
    if (end >= trimmed.length) break;
    start = end - CHUNK_OVERLAP;
  }
  return chunks.filter((c) => c.length > 0);
}

/**
 * Embed + index a source row. Throws on failure — use embedSourceSafe
 * from application code.
 */
export async function embedSource(args: EmbedSourceArgs): Promise<number> {
  const adapter = getEmbeddingAdapter();
  if (!adapter) return 0; // embeddings disabled — silent no-op

  const chunks = chunkText(args.text);
  if (chunks.length === 0) return 0;

  const vectors = await adapter.embed(chunks);

  for (let i = 0; i < chunks.length; i++) {
    await upsertEmbedding({
      sourceType: args.sourceType,
      sourceId: args.sourceId,
      chunkIndex: i,
      chunkText: chunks[i]!,
      embedding: vectors[i]!,
      embeddingModel: `${adapter.name}:${adapter.model}`,
      operatorId: args.operatorId ?? null,
      domain: args.domain ?? null,
    });
  }
  return chunks.length;
}

/**
 * Fire-and-forget wrapper. Call sites do NOT await meaningfully —
 * they call this after their own write succeeds and move on.
 */
export function embedSourceSafe(args: EmbedSourceArgs): void {
  embedSource(args).catch((err) => {
    console.warn(
      `[embed] non-fatal: failed to index ${args.sourceType}/${args.sourceId}:`,
      err?.message ?? err
    );
  });
}
