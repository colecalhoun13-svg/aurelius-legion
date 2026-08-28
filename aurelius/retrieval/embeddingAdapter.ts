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

// ── Embed-once cache (router efficiency, Build #1) ──────────────────
//
// Within ONE turn the same user message is embedded by up to five independent
// layers — operator routing, semantic recall, compiled-pattern retrieval,
// semantic reuse, and decision precedent. An embedding is a pure function of
// (provider, model, text), so calls 2..5 are wasted network round-trips that
// cost latency and money and change nothing. A bounded LRU keyed by the
// provider SIGNATURE + text collapses them to one.
//
// Correctness: a hit returns the identical vector the provider would have
// returned — same geometry, same recall. The key carries `${name}:${model}`,
// so a provider/model swap misses cleanly rather than serving stale geometry
// (this is the same signature reindex.ts guards the index with). The cache is
// process-local and never persisted, so it can never outlive a redeploy.
// Fallback: if anything here throws, the wrapper is transparent — callers get
// exactly the base adapter's behavior.

const EMBED_CACHE_MAX = Math.max(256, Number(process.env.EMBED_CACHE_MAX) || 4096);
// Single-flight: the value is the in-flight (or settled) embed PROMISE, so a
// concurrent second caller for the same text awaits the first call instead of
// launching its own — the "embed ONCE" guarantee holds even when independent
// prompt layers embed the same message in parallel.
const embedCache = new Map<string, Promise<number[]>>(); // insertion-ordered → cheap LRU
let embedCacheHits = 0;
let embedCacheMisses = 0;

/** Observability (the "output" half of the spec): callers/tests/doctor can see
 *  the cache is actually collapsing duplicate embeds instead of guessing. */
export function embedCacheStats(): { hits: number; misses: number; size: number; max: number } {
  return { hits: embedCacheHits, misses: embedCacheMisses, size: embedCache.size, max: EMBED_CACHE_MAX };
}

function cacheGet(key: string): Promise<number[]> | undefined {
  const v = embedCache.get(key);
  if (v !== undefined) {
    // Touch → move to newest slot (LRU recency via insertion order).
    embedCache.delete(key);
    embedCache.set(key, v);
  }
  return v;
}

function cacheSet(key: string, vec: Promise<number[]>): void {
  if (embedCache.has(key)) embedCache.delete(key);
  embedCache.set(key, vec);
  while (embedCache.size > EMBED_CACHE_MAX) {
    const oldest = embedCache.keys().next().value;
    if (oldest === undefined) break;
    embedCache.delete(oldest);
  }
}

/**
 * Wrap a base adapter so identical (provider, model, text) embeds are served
 * from one in-flight call. Batch-aware: only the cache MISSES hit the provider,
 * together in a single batched call, and the merged result preserves input
 * order exactly. name/model/dims pass through untouched so the index signature
 * and doctor probes are unchanged. A provider ERROR evicts the failed keys so
 * the next turn retries cleanly rather than caching a rejection.
 */
function withEmbedCache(base: EmbeddingAdapter): EmbeddingAdapter {
  const sig = `${base.name}:${base.model}:${base.dims} `;
  return {
    name: base.name,
    model: base.model,
    dims: base.dims,
    async embed(texts: string[]): Promise<number[][]> {
      type Slot = { promise: Promise<number[]>; resolve?: (v: number[]) => void; reject?: (e: unknown) => void; text?: string; key?: string };
      const slots: Slot[] = [];
      const missSlots: Slot[] = [];
      for (const text of texts) {
        const key = sig + text;
        const existing = cacheGet(key);
        if (existing) {
          embedCacheHits++;
          slots.push({ promise: existing });
        } else {
          embedCacheMisses++;
          let resolve!: (v: number[]) => void;
          let reject!: (e: unknown) => void;
          const promise = new Promise<number[]>((res, rej) => { resolve = res; reject = rej; });
          const slot: Slot = { promise, resolve, reject, text, key };
          cacheSet(key, promise);
          slots.push(slot);
          missSlots.push(slot);
        }
      }
      if (missSlots.length > 0) {
        try {
          const fresh = await base.embed(missSlots.map((s) => s.text!));
          missSlots.forEach((s, j) => s.resolve!(fresh[j]));
        } catch (err) {
          for (const s of missSlots) {
            if (s.key && embedCache.get(s.key) === s.promise) embedCache.delete(s.key);
            s.reject!(err);
          }
          throw err;
        }
      }
      return Promise.all(slots.map((s) => s.promise));
    },
  };
}

// Base adapters are module singletons, so a stable wrapper per base keeps
// getEmbeddingAdapter() returning a consistent reference across calls.
const wrappedAdapters = new WeakMap<EmbeddingAdapter, EmbeddingAdapter>();
function cached(base: EmbeddingAdapter): EmbeddingAdapter {
  let w = wrappedAdapters.get(base);
  if (!w) {
    w = withEmbedCache(base);
    wrappedAdapters.set(base, w);
  }
  return w;
}

// ── Resolution ──────────────────────────────────────────────────────

/**
 * Returns the active adapter, or null when embeddings are disabled.
 * Disabled when: RETRIEVAL_EMBEDDINGS_ENABLED=false, or no provider
 * has credentials. Callers must treat null as "skip silently" — the
 * system runs fine without recall; it just doesn't remember semantically.
 */
/**
 * The worst failure this system had: a provider selected with no key returned
 * null and logged NOTHING. Every caller treats null as "skip silently", so
 * semantic recall, /ask sources, semantic reuse, pattern retrieval and decision
 * precedent all went dark at once and Aurelius simply looked forgetful. Say it
 * once, loudly, per process.
 */
let keylessWarned = false;
function warnKeyless(provider: string, keyName: string): null {
  if (!keylessWarned) {
    keylessWarned = true;
    console.error(
      `[embeddings] DISABLED — EMBEDDINGS_PROVIDER=${provider} but ${keyName} is not set. ` +
        `Semantic recall, /ask sources, semantic reuse, compiled-pattern retrieval and ` +
        `decision precedent are ALL off until you set ${keyName} (or switch EMBEDDINGS_PROVIDER ` +
        `to the provider you do have a key for).`
    );
  }
  return null;
}

export function getEmbeddingAdapter(): EmbeddingAdapter | null {
  if (process.env.RETRIEVAL_EMBEDDINGS_ENABLED === "false") return null;

  const provider = (process.env.EMBEDDINGS_PROVIDER ?? "openai").trim().toLowerCase();
  if (provider === "mock") return cached(mockEmbeddingAdapter);
  if (provider === "openai") {
    if (process.env.OPENAI_API_KEY) return cached(openaiEmbeddingAdapter);
    return warnKeyless("openai", "OPENAI_API_KEY");
  }
  if (provider === "gemini") {
    if (process.env.GEMINI_API_KEY) return cached(geminiEmbeddingAdapter);
    return warnKeyless("gemini", "GEMINI_API_KEY");
  }
  // Future: "ollama" adapter slots in here (Mac Mini phase).
  console.warn(`[embeddings] unknown EMBEDDINGS_PROVIDER "${provider}" — retrieval disabled`);
  return null;
}

export function embeddingsEnabled(): boolean {
  return getEmbeddingAdapter() !== null;
}
