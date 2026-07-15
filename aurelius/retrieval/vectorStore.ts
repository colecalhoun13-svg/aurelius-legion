// aurelius/retrieval/vectorStore.ts
//
// Phase 4.6 — pgvector access layer.
//
// Prisma can't touch Unsupported("vector") columns, so every read/write
// of VectorEmbedding.embedding goes through raw SQL here. Nothing else
// in the codebase writes this table.

import { prisma } from "../core/db/prisma.ts";

export type EmbeddingSourceType =
  | "knowledge_entry"
  | "memory"
  | "reasoning_cache"
  | "note"
  | "task"
  | "project"
  | "corpus_doc"
  | "wiki_page";

export type UpsertEmbeddingArgs = {
  sourceType: EmbeddingSourceType;
  sourceId: string;
  chunkIndex: number;
  chunkText: string;
  embedding: number[];
  embeddingModel: string;
  operatorId?: string | null;
  domain?: string | null;
};

export type SimilarChunk = {
  id: string;
  sourceType: string;
  sourceId: string;
  chunkIndex: number;
  chunkText: string;
  operatorId: string | null;
  domain: string | null;
  similarity: number; // 1 - cosine distance, higher = closer
  createdAt?: Date;   // for recency-weighted reranking
};

function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}

export async function upsertEmbedding(args: UpsertEmbeddingArgs): Promise<void> {
  const vec = toVectorLiteral(args.embedding);
  // cuid() default doesn't apply on raw inserts — generate an id here.
  const id = `vemb_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  await prisma.$executeRawUnsafe(
    `INSERT INTO "VectorEmbedding"
       ("id", "sourceType", "sourceId", "chunkIndex", "chunkText", "operatorId", "domain", "embedding", "embeddingModel")
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::vector, $9)
     ON CONFLICT ("sourceType", "sourceId", "chunkIndex")
     DO UPDATE SET
       "chunkText" = EXCLUDED."chunkText",
       "operatorId" = EXCLUDED."operatorId",
       "domain" = EXCLUDED."domain",
       "embedding" = EXCLUDED."embedding",
       "embeddingModel" = EXCLUDED."embeddingModel"`,
    id,
    args.sourceType,
    args.sourceId,
    args.chunkIndex,
    args.chunkText,
    args.operatorId ?? null,
    args.domain ?? null,
    vec,
    args.embeddingModel
  );
}

/**
 * Cosine similarity search. Filters:
 * - sourceTypes: restrict which tables' content can surface
 * - operatorId: entries for this operator OR entries with no operator
 *   (cross-domain). Omit to search everything.
 */
export async function searchSimilar(args: {
  embedding: number[];
  limit?: number;
  sourceTypes?: EmbeddingSourceType[];
  operatorId?: string;
  embeddingModel?: string;
}): Promise<SimilarChunk[]> {
  const vec = toVectorLiteral(args.embedding);
  const limit = Math.min(args.limit ?? 8, 50);

  const conditions: string[] = [`"embedding" IS NOT NULL`];
  const params: any[] = [vec];
  let p = 2;

  // Never cosine-compare across embedding models — different models produce
  // incompatible vector geometries, so a query embedded by model A must only
  // match rows embedded by model A. Without this, switching providers (e.g.
  // OpenAI → Gemini) silently returns nonsense until every row is re-embedded.
  if (args.embeddingModel) {
    conditions.push(`"embeddingModel" = $${p}`);
    params.push(args.embeddingModel);
    p++;
  }

  if (args.sourceTypes && args.sourceTypes.length > 0) {
    conditions.push(`"sourceType" = ANY($${p}::text[])`);
    params.push(args.sourceTypes);
    p++;
  }
  if (args.operatorId) {
    conditions.push(`("operatorId" = $${p} OR "operatorId" IS NULL)`);
    params.push(args.operatorId);
    p++;
  }

  const rows: any[] = await prisma.$queryRawUnsafe(
    `SELECT "id", "sourceType", "sourceId", "chunkIndex", "chunkText",
            "operatorId", "domain", "createdAt",
            1 - ("embedding" <=> $1::vector) AS similarity
     FROM "VectorEmbedding"
     WHERE ${conditions.join(" AND ")}
     ORDER BY "embedding" <=> $1::vector
     LIMIT ${limit}`,
    ...params
  );

  return rows.map((r) => ({
    id: r.id,
    sourceType: r.sourceType,
    sourceId: r.sourceId,
    chunkIndex: Number(r.chunkIndex),
    chunkText: r.chunkText,
    operatorId: r.operatorId,
    domain: r.domain,
    similarity: Number(r.similarity),
    createdAt: r.createdAt ? new Date(r.createdAt) : undefined,
  }));
}

export async function deleteEmbeddingsForSource(
  sourceType: EmbeddingSourceType,
  sourceId: string
): Promise<void> {
  await prisma.$executeRawUnsafe(
    `DELETE FROM "VectorEmbedding" WHERE "sourceType" = $1 AND "sourceId" = $2`,
    sourceType,
    sourceId
  );
}

/**
 * Delete stale tail chunks left over when a source is re-embedded into FEWER
 * chunks than before. upsertEmbedding overwrites chunk 0..N-1 but never removes
 * old chunk N.., so an edited/shortened source would otherwise leave superseded
 * text in the index that resurfaces as a confident (wrong) hit. Called after a
 * re-embed with the new chunk count.
 */
export async function deleteEmbeddingChunksFrom(
  sourceType: EmbeddingSourceType,
  sourceId: string,
  fromChunkIndex: number
): Promise<void> {
  await prisma.$executeRawUnsafe(
    `DELETE FROM "VectorEmbedding" WHERE "sourceType" = $1 AND "sourceId" = $2 AND "chunkIndex" >= $3`,
    sourceType,
    sourceId,
    fromChunkIndex
  );
}

export async function countEmbeddings(): Promise<number> {
  const rows: any[] = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*)::int AS n FROM "VectorEmbedding"`
  );
  return Number(rows[0]?.n ?? 0);
}
