// aurelius/compiled/patternIndex.ts
//
// SEMANTIC RETRIEVAL OF THE COMPILED LENS (council fix #1 — First-Principles).
//
// A heuristic is abstract ("When the downside is irreversible, size to survive
// being wrong") and Cole's decisions are concrete ("take this client or protect
// Tuesday's session"). They share almost no WORDS, so the old lexical fit-ranker
// scored the transferable rules zero and fell back to top-N-by-confidence — the
// exact quote-the-canon behavior the arc was built to kill.
//
// The fix: match on SITUATION STRUCTURE, not shared tokens. We embed each
// heuristic's WHEN-clause (the trigger condition) and, at decision time, cosine-
// rank those trigger-vectors against the decision. A rule loads because its
// precondition matches the decision's shape — which is precisely what lexical
// overlap cannot see. Cole-derived heuristics (mined from his own corrections)
// get a small additive bonus: his judgment is the one lens the frozen model can't
// contain, so on a close call it wins.
//
// Rides the existing vector substrate (VectorEmbedding + searchSimilar +
// embeddingAdapter). Honest-failure: no embedding engine → indexing is a no-op and
// retrieval returns null so the caller falls back to confidence order.

import { prisma } from "../core/db/prisma.ts";
import { getEmbeddingAdapter } from "../retrieval/embeddingAdapter.ts";
import { upsertEmbedding, searchSimilar } from "../retrieval/vectorStore.ts";

const PATTERN_SOURCE = "compiled_pattern" as const;

// A close-call nudge for heuristics that came from Cole's own corrections/decisions
// (vs. the canon). Mirrors retrieve.ts SOURCE_PRIOR magnitudes: enough to win a tie
// or a near-tie, never enough to override a clearly stronger situational match.
export const COLE_BONUS = 0.08;

/** The rule text of a pattern (the distilled heuristic), citation aside. */
function ruleOf(sig: any): string {
  if (sig && typeof sig === "object" && typeof sig.recurringReasoningTheme === "string") {
    return sig.recurringReasoningTheme.trim();
  }
  return "";
}

/** The provenance string ("curriculum: <book>" | "cole's corrections" | ...). */
export function sourceOf(sig: any): string {
  return sig && typeof sig === "object" && typeof sig.source === "string" ? sig.source : "";
}

/** True when the heuristic was mined from Cole's own judgment, not the canon. */
export function isColeDerived(sig: any, evidence?: string[]): boolean {
  const s = (sourceOf(sig) || (evidence && evidence[0]) || "").toLowerCase();
  return /\bcole\b|correction|decision curriculum|ratified/.test(s);
}

/**
 * The SITUATION clause a heuristic triggers on. Matching happens on this, not the
 * action or the rationale — a lens fires when its precondition matches the decision.
 * "When <situation>, <do this> — because <reason>" → "<situation>".
 *
 * The situation itself may contain commas ("tired, sore, or unmotivated"), so we
 * strip the rationale first, then drop only the FINAL comma-segment (the action) —
 * a lazy first-comma cut would embed "you're tired" and lose the condition.
 */
export function extractWhenClause(heuristic: string): string {
  const h = (heuristic ?? "").trim();
  if (!h) return "";
  const head = h.split(/\s*(?:—|–|\bbecause\b|\bso that\b)\s*/i)[0].trim();
  const m = head.match(/^\s*(?:when|if|whenever)\b\s+(.+)$/i);
  if (!m) return head || h;
  const body = m[1].trim();
  const segs = body.split(/\s*,\s*/);
  if (segs.length <= 1) return body;
  const situation = segs.slice(0, -1).join(", ").trim();
  return situation.length >= 4 ? situation : body;
}

/**
 * Embed a pattern's when-clause into the vector index so decisions can retrieve it
 * by situation. Honest no-op without an embedding engine (retrieval falls back).
 * Returns true if a vector was written.
 */
export async function indexPattern(p: {
  id: string;
  operatorId: string;
  domain: string;
  patternSignature: any;
}): Promise<boolean> {
  const adapter = getEmbeddingAdapter();
  if (!adapter) return false;
  const rule = ruleOf(p.patternSignature);
  if (!rule) return false;
  const whenClause = extractWhenClause(rule) || rule;
  const [vec] = await adapter.embed([whenClause.slice(0, 6000)]);
  if (!vec) return false;
  await upsertEmbedding({
    sourceType: PATTERN_SOURCE,
    sourceId: p.id,
    chunkIndex: 0,
    chunkText: whenClause,
    embedding: vec,
    embeddingModel: `${adapter.name}:${adapter.model}`,
    operatorId: p.operatorId,
    domain: p.domain,
  });
  return true;
}

/** Fire-and-forget indexing — never blocks or breaks the write path. */
export function indexPatternSafe(p: { id: string; operatorId: string; domain: string; patternSignature: any }): void {
  indexPattern(p).catch((err) => console.warn("[patternIndex] index failed (non-fatal):", (err as any)?.message ?? err));
}

/**
 * Backfill: embed USABLE patterns (confirmed + factual — proposed/discarded
 * vectors would only crowd the retrieval window) that aren't already indexed by
 * the CURRENT embedding model. Cost-idempotent: already-indexed patterns cost
 * zero embedding calls, so a boot re-run is free, not N API calls.
 */
export async function indexConfirmedPatterns(operatorId?: string): Promise<number> {
  const adapter = getEmbeddingAdapter();
  if (!adapter) return 0;
  const model = `${adapter.name}:${adapter.model}`;
  const existing = await prisma.vectorEmbedding.findMany({
    where: { sourceType: PATTERN_SOURCE, embeddingModel: model },
    select: { sourceId: true },
  });
  const have = new Set(existing.map((e) => e.sourceId));
  const patterns = await prisma.compiledPattern.findMany({
    where: {
      status: { in: ["auto_factual", "confirmed_heuristic"] },
      ...(operatorId ? { operatorId } : {}),
    },
    select: { id: true, operatorId: true, domain: true, patternSignature: true },
  });
  let n = 0;
  for (const p of patterns) {
    if (have.has(p.id)) continue;
    try {
      if (await indexPattern(p as any)) n++;
    } catch (err) {
      console.warn("[patternIndex] backfill skip:", (err as any)?.message ?? err);
    }
  }
  return n;
}

/** GC: a retired rule leaves the index — dead vectors crowd the retrieval window. */
export function removePatternVectorSafe(patternId: string): void {
  import("../retrieval/vectorStore.ts")
    .then(({ deleteEmbeddingsForSource }) => deleteEmbeddingsForSource(PATTERN_SOURCE, patternId))
    .catch((err) => console.warn("[patternIndex] vector GC failed (non-fatal):", (err as any)?.message ?? err));
}

/**
 * Retrieve the operator's patterns ranked by FIT to the decision — cosine of the
 * decision against each heuristic's when-clause. Returns id→score for the closest
 * matches, or null when embeddings are off (caller falls back to confidence order).
 */
export async function retrieveFitPatterns(args: {
  operatorId: string;
  query: string;
  limit?: number;
}): Promise<Array<{ id: string; score: number }> | null> {
  const adapter = getEmbeddingAdapter();
  if (!adapter || !args.query || !args.query.trim()) return null;
  const [qv] = await adapter.embed([args.query.slice(0, 6000)]);
  if (!qv) return null;
  const hits = await searchSimilar({
    embedding: qv,
    limit: args.limit ?? 40,
    sourceTypes: [PATTERN_SOURCE],
    operatorId: args.operatorId,
    embeddingModel: `${adapter.name}:${adapter.model}`,
  });
  return hits.map((h) => ({ id: h.sourceId, score: h.similarity }));
}
