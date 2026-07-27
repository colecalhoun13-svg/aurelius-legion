// aurelius/research/researchAdapters/relevance.ts
//
// THE RELEVANCE GATE — the fix for nine-for-nine dead pulls. Open archives
// (arXiv especially) return *something* for any query; without a gate,
// "Why We Sleep — Matthew Walker" comes back as ATLAS detector physics and
// gets fused into the synthesis as if it were evidence. A result now has to
// actually mention the subject to survive.

import type { ResearchResult } from "../researchTypes.ts";

const STOP = new Set([
  "the", "a", "an", "of", "and", "or", "in", "on", "to", "for", "by", "with",
  "from", "into", "vs", "via", "its", "his", "her", "their", "our", "your",
  "key", "core", "how", "what", "why", "when", "practical", "principles",
  "guide", "book", "author", "classic", "chinese", "edition",
]);

/** Meaningful lowercase tokens of a subject line — stopwords and dashes out. */
export function significantTokens(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w));
}

/**
 * Keep only results whose title+snippet actually overlap the subject.
 * `minShare` = fraction of the subject's significant tokens that must appear
 * (works want a strict match — we're looking for THE book, not the topic).
 */
export function filterRelevant(
  subject: string,
  results: ResearchResult[],
  minShare = 0.34
): ResearchResult[] {
  const tokens = significantTokens(subject);
  if (tokens.length === 0) return results;
  return results.filter((r) => {
    const hay = `${r.title} ${r.snippet}`.toLowerCase();
    const hits = tokens.filter((t) => hay.includes(t)).length;
    return hits / tokens.length >= minShare;
  });
}
