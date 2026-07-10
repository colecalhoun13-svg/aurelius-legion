// aurelius/retrieval/embeddingAdapter.ts
//
// Phase 4.6 — Embedding adapter interface.
//
// The vector index is DERIVED data — rebuildable from source tables at any
// time — so the embedding provider is swappable. v1 ships OpenAI
// (text-embedding-3-small, 1536 dims, ~$0.02/M tokens). When the Mac Mini
// lands, an Ollama adapter implements the same interface and a backfill
// re-embeds everything locally for $0.
//
// "mock" provider exists for tests and keyless environments: deterministic
// pseudo-embeddings from a seeded hash. Real cosine geometry, no API.

export type EmbeddingAdapter = {
  name: string;
  model: string;
  dims: number;
  embed(texts: string[]): Promise<number[][]>;
};

export const EMBEDDING_DIMS = 1536;

// ── OpenAI adapter ──────────────────────────────────────────────────

const openaiEmbeddingAdapter: EmbeddingAdapter = {
  name: "openai",
  model: "text-embedding-3-small",
  dims: EMBEDDING_DIMS,
  async embed(texts: string[]): Promise<number[][]> {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error("OPENAI_API_KEY not set — embeddings unavailable");

    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: this.model,
        input: texts,
        dimensions: EMBEDDING_DIMS,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`OpenAI embeddings failed (${res.status}): ${body.slice(0, 200)}`);
    }

    const json: any = await res.json();
    // API returns data sorted by index, but sort defensively.
    const rows = [...json.data].sort((a: any, b: any) => a.index - b.index);
    return rows.map((r: any) => r.embedding as number[]);
  },
};

// ── Gemini adapter (free tier) ──────────────────────────────────────
// gemini-embedding-001 supports Matryoshka output sizing — we request
// exactly EMBEDDING_DIMS so the pgvector column works unchanged. Vectors
// at reduced dimensionality come back unnormalized; we L2-normalize.
// Free-tier rate limits are real: one retry with backoff on 429.

const geminiEmbeddingAdapter: EmbeddingAdapter = {
  name: "gemini",
  model: "gemini-embedding-001",
  dims: EMBEDDING_DIMS,
  async embed(texts: string[]): Promise<number[][]> {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error("GEMINI_API_KEY not set — embeddings unavailable");

    const body = JSON.stringify({
      requests: texts.map((t) => ({
        model: `models/${this.model}`,
        content: { parts: [{ text: t }] },
        outputDimensionality: EMBEDDING_DIMS,
      })),
    });

    const call = () =>
      fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:batchEmbedContents?key=${key}`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body }
      );

    let res = await call();
    if (res.status === 429) {
      // free-tier rate limit — back off once and retry
      await new Promise((r) => setTimeout(r, 5000));
      res = await call();
    }
    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Gemini embeddings failed (${res.status}): ${errBody.slice(0, 200)}`);
    }

    const json: any = await res.json();
    const embeddings: number[][] = (json.embeddings ?? []).map(
      (e: any) => e.values as number[]
    );
    if (embeddings.length !== texts.length) {
      throw new Error(
        `Gemini returned ${embeddings.length} embeddings for ${texts.length} inputs`
      );
    }
    // L2-normalize (required when outputDimensionality < native size)
    return embeddings.map((v) => {
      const norm = Math.sqrt(v.reduce((acc, x) => acc + x * x, 0)) || 1;
      return v.map((x) => x / norm);
    });
  },
};

// ── Mock adapter (tests / keyless environments) ─────────────────────
// Deterministic: same text → same vector. Similar texts do NOT map to
// similar vectors (it's a hash, not a model) — fine for pipeline tests,
// useless for semantic quality. Never enabled implicitly in production;
// requires EMBEDDINGS_PROVIDER=mock.

const mockEmbeddingAdapter: EmbeddingAdapter = {
  name: "mock",
  model: "mock-hash-v1",
  dims: EMBEDDING_DIMS,
  async embed(texts: string[]): Promise<number[][]> {
    return texts.map((t) => {
      const v = new Array(EMBEDDING_DIMS).fill(0);
      let h = 2166136261;
      for (let i = 0; i < t.length; i++) {
        h ^= t.charCodeAt(i);
        h = Math.imul(h, 16777619);
      }
      // xorshift stream seeded by the text hash
      let s = h >>> 0 || 1;
      for (let i = 0; i < EMBEDDING_DIMS; i++) {
        s ^= s << 13; s >>>= 0;
        s ^= s >> 17;
        s ^= s << 5; s >>>= 0;
        v[i] = (s / 0xffffffff) * 2 - 1;
      }
      // normalize to unit length so cosine behaves
      const norm = Math.sqrt(v.reduce((acc, x) => acc + x * x, 0)) || 1;
      return v.map((x) => x / norm);
    });
  },
};

// ── Resolution ──────────────────────────────────────────────────────

/**
 * Returns the active adapter, or null when embeddings are disabled.
 * Disabled when: RETRIEVAL_EMBEDDINGS_ENABLED=false, or no provider
 * has credentials. Callers must treat null as "skip silently" — the
 * system runs fine without recall; it just doesn't remember semantically.
 */
export function getEmbeddingAdapter(): EmbeddingAdapter | null {
  if (process.env.RETRIEVAL_EMBEDDINGS_ENABLED === "false") return null;

  const provider = (process.env.EMBEDDINGS_PROVIDER ?? "openai").trim().toLowerCase();
  if (provider === "mock") return mockEmbeddingAdapter;
  if (provider === "openai") {
    return process.env.OPENAI_API_KEY ? openaiEmbeddingAdapter : null;
  }
  if (provider === "gemini") {
    return process.env.GEMINI_API_KEY ? geminiEmbeddingAdapter : null;
  }
  // Future: "ollama" adapter slots in here (Mac Mini phase).
  console.warn(`[embeddings] unknown EMBEDDINGS_PROVIDER "${provider}" — retrieval disabled`);
  return null;
}

export function embeddingsEnabled(): boolean {
  return getEmbeddingAdapter() !== null;
}
