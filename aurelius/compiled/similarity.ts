// aurelius/compiled/similarity.ts
//
// Domain-agnostic similarity scoring between TaggedSignatures.
// Engine compares STRUCTURED TAGS, not raw inputs. So 3x6,5,5 and 3x8,6,6
// score differently because their tags differ (strength vs strength_endurance),
// even though raw rep arrays look similar.

import type { TaggedSignature } from "./types.ts";

/**
 * Compute structural similarity between two tagged signatures.
 * Returns 0-1 where 1 = identical, 0 = completely different.
 *
 * Algorithm:
 * - Iterate over keys in both signatures' tags
 * - Full credit for matching primitive values
 * - Partial credit for matching nested objects (recursive)
 * - Zero for keys present in one but not the other
 */
export function similarityScore(a: TaggedSignature, b: TaggedSignature): number {
  if (!a?.tags || !b?.tags) return 0;
  return scoreObjects(a.tags, b.tags);
}

function scoreObjects(a: Record<string, any>, b: Record<string, any>): number {
  const allKeys = new Set([...Object.keys(a), ...Object.keys(b)]);
  if (allKeys.size === 0) return 1;

  let totalScore = 0;
  for (const key of allKeys) {
    const va = a[key];
    const vb = b[key];
    if (va === undefined || vb === undefined) {
      totalScore += 0;
      continue;
    }
    totalScore += scoreValues(va, vb);
  }
  return totalScore / allKeys.size;
}

function scoreValues(a: any, b: any): number {
  if (a == null && b == null) return 1;
  if (a == null || b == null) return 0;

  if (typeof a !== "object" && typeof b !== "object") {
    return a === b ? 1 : 0;
  }

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length === 0 && b.length === 0) return 1;
    if (a.length !== b.length) return 0.5;   // partial for same-shape mismatch
    let s = 0;
    for (let i = 0; i < a.length; i++) {
      s += scoreValues(a[i], b[i]);
    }
    return s / a.length;
  }

  if (typeof a === "object" && typeof b === "object") {
    return scoreObjects(a as Record<string, any>, b as Record<string, any>);
  }

  return 0;
}

/**
 * Quick fingerprint match — exact equality of fingerprint strings.
 * Fast pre-filter before similarity scoring.
 */
export function fingerprintMatch(a: TaggedSignature, b: TaggedSignature): boolean {
  return !!a?.fingerprint && a.fingerprint === b?.fingerprint;
}
