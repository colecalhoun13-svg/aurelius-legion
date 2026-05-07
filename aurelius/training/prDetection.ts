// aurelius/training/prDetection.ts
//
// Deterministic PR detection. No LLM, no API calls.
// Computes estimated 1RM via Brzycki for each working set, compares
// against existing PRs in memory, surfaces new PRs to the reasoning layer.
//
// Brzycki formula: 1RM = weight / (1.0278 - 0.0278 * reps)
// Valid for reps roughly 1-10. Above 10 reps, the formula drifts —
// we cap the calculation at 10 reps and flag higher-rep sets.

import type { SessionRow } from "./volume.ts";
import { parseReps, parseLoads, parseSets } from "./volume.ts";

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

export type SetEstimate = {
  load: number;
  reps: number;
  estimated1RM: number;
  brzyckiCappedAt10: boolean; // true if reps > 10, formula capped
};

export type ExercisePREstimate = {
  exercise: string;
  bestEstimated1RM: number;       // best across this session
  bestSet: SetEstimate | null;    // the set that produced bestEstimated1RM
  allSets: SetEstimate[];         // every working set's estimate
};

export type KnownPR = {
  exercise: string;
  estimated1RM: number;
  date: string;        // when the PR was set
  source: "memory" | "maxes_tab" | "computed";
};

export type PRComparison = {
  exercise: string;
  newEstimate: number;
  previousBest: number | null;     // null if no prior PR known
  isNewPR: boolean;
  improvement: number;             // positive = improvement, in lb
  improvementPct: number;          // % over previous PR
};

// ═══════════════════════════════════════════════════════════════════
// BRZYCKI FORMULA
// 1RM = load / (1.0278 - 0.0278 * reps)
// Works cleanly for reps 1-10. For reps > 10, we cap at 10 because
// the formula starts overestimating heavily beyond that range.
// ═══════════════════════════════════════════════════════════════════

export function brzycki1RM(load: number, reps: number): { estimate: number; cappedAt10: boolean } {
  if (load <= 0 || reps <= 0) return { estimate: 0, cappedAt10: false };

  const cappedAt10 = reps > 10;
  const repsForFormula = cappedAt10 ? 10 : reps;

  // Brzycki: weight × (36 / (37 - reps)) is the canonical form;
  // weight / (1.0278 - 0.0278 × reps) is mathematically equivalent.
  const estimate = load / (1.0278 - 0.0278 * repsForFormula);
  return {
    estimate: Math.round(estimate),
    cappedAt10,
  };
}

// ═══════════════════════════════════════════════════════════════════
// PER-EXERCISE PR ESTIMATE FROM A SESSION ROW
// Computes 1RM for every working set, returns the best.
// Mirrors the alignment logic in volume.ts so we stay consistent
// about which load goes with which rep count.
// ═══════════════════════════════════════════════════════════════════

export function estimateExercisePR(row: SessionRow): ExercisePREstimate {
  const sets = parseSets(row.sets);
  const reps = parseReps(row.reps);
  const loads = parseLoads(row.load);

  const allSets: SetEstimate[] = [];

  // Per-set loads + per-set reps, both aligned with working-set count
  if (loads.length === sets.working && reps.length === sets.working) {
    for (let i = 0; i < sets.working; i++) {
      const r = reps[i]!;
      const l = loads[i]!;
      const { estimate, cappedAt10 } = brzycki1RM(l, r);
      allSets.push({ load: l, reps: r, estimated1RM: estimate, brzyckiCappedAt10: cappedAt10 });
    }
  } else if (loads.length === sets.working && reps.length === 1) {
    const r = reps[0]!;
    for (const l of loads) {
      const { estimate, cappedAt10 } = brzycki1RM(l, r);
      allSets.push({ load: l, reps: r, estimated1RM: estimate, brzyckiCappedAt10: cappedAt10 });
    }
  } else if (reps.length === sets.working && loads.length === 1) {
    const l = loads[0]!;
    for (const r of reps) {
      const { estimate, cappedAt10 } = brzycki1RM(l, r);
      allSets.push({ load: l, reps: r, estimated1RM: estimate, brzyckiCappedAt10: cappedAt10 });
    }
  } else if (loads.length === 1 && reps.length === 1 && sets.working > 0) {
    const l = loads[0]!;
    const r = reps[0]!;
    const { estimate, cappedAt10 } = brzycki1RM(l, r);
    // All working sets identical — record one entry per set
    for (let i = 0; i < sets.working; i++) {
      allSets.push({ load: l, reps: r, estimated1RM: estimate, brzyckiCappedAt10: cappedAt10 });
    }
  }
  // Bodyweight or unparseable load → no 1RM estimate possible (allSets stays empty)

  let bestEstimated1RM = 0;
  let bestSet: SetEstimate | null = null;
  for (const s of allSets) {
    if (s.estimated1RM > bestEstimated1RM) {
      bestEstimated1RM = s.estimated1RM;
      bestSet = s;
    }
  }

  return {
    exercise: row.exercise,
    bestEstimated1RM,
    bestSet,
    allSets,
  };
}

// ═══════════════════════════════════════════════════════════════════
// SESSION-LEVEL PR ESTIMATE
// Estimate PRs for every exercise in a session.
// Returns a map of exercise name → estimate.
// ═══════════════════════════════════════════════════════════════════

export function estimateSessionPRs(rows: SessionRow[]): Map<string, ExercisePREstimate> {
  const result = new Map<string, ExercisePREstimate>();

  for (const row of rows) {
    const exerciseName = (row.exercise ?? "").trim();
    if (!exerciseName) continue;

    const estimate = estimateExercisePR(row);

    // If we've seen this exercise before in the same session, keep the higher estimate
    const existing = result.get(exerciseName);
    if (existing && existing.bestEstimated1RM >= estimate.bestEstimated1RM) {
      continue;
    }
    result.set(exerciseName, estimate);
  }

  return result;
}

// ═══════════════════════════════════════════════════════════════════
// PR COMPARISON
// Given a session's exercise estimates AND a list of known prior PRs,
// determine which exercises produced new PRs.
// ═══════════════════════════════════════════════════════════════════

export function comparePRs(
  sessionEstimates: Map<string, ExercisePREstimate>,
  knownPRs: KnownPR[]
): PRComparison[] {
  // Build lookup of best known PR per exercise (case-insensitive match)
  const bestKnown = new Map<string, KnownPR>();
  for (const pr of knownPRs) {
    const key = pr.exercise.toLowerCase().trim();
    const existing = bestKnown.get(key);
    if (!existing || pr.estimated1RM > existing.estimated1RM) {
      bestKnown.set(key, pr);
    }
  }

  const comparisons: PRComparison[] = [];

  for (const [exerciseName, estimate] of sessionEstimates.entries()) {
    if (estimate.bestEstimated1RM <= 0) continue; // no measurable 1RM (bodyweight, etc.)

    const key = exerciseName.toLowerCase().trim();
    const prior = bestKnown.get(key);
    const previousBest = prior ? prior.estimated1RM : null;

    const isNewPR = previousBest === null
      ? true                                    // first time we've seen this exercise = baseline PR
      : estimate.bestEstimated1RM > previousBest;

    const improvement = previousBest !== null
      ? estimate.bestEstimated1RM - previousBest
      : 0;

    const improvementPct = previousBest !== null && previousBest > 0
      ? Math.round(((estimate.bestEstimated1RM - previousBest) / previousBest) * 100)
      : 0;

    comparisons.push({
      exercise: exerciseName,
      newEstimate: estimate.bestEstimated1RM,
      previousBest,
      isNewPR,
      improvement,
      improvementPct,
    });
  }

  return comparisons;
}

/**
 * Convenience: filter to only NEW PRs.
 */
export function newPRsOnly(comparisons: PRComparison[]): PRComparison[] {
  return comparisons.filter((c) => c.isNewPR);
}