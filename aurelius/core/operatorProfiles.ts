import { operatorCoresByName } from "../operators/operatorCores.ts";

/**
 * Aurelius OS v3.4 — Operator Identity Layer
 * Full behavioral, routing, autonomy, and reasoning profile.
 */

export type OperatorProfile = {
  // 1. Core identity
  name: string;
  domain: string;
  mission: string;

  // 2. Reasoning framework
  principles: string[];
  constraints: string[];
  heuristics: string[];
  questions: string[];

  // 3. Behavioral style (task-evolutionary, precision-first)
  tonePolicy?: {
    defaultTone: "precise" | "direct" | "measured";
    underUrgencyTone?: "compressed" | "decisive" | "blunt";
  };

  // 4. Decision profile (depth, speed, risk, correctness, time-awareness)
  decisionProfile?: {
    depthBias: "shallow" | "medium" | "deep";
    speedBias: "slow" | "balanced" | "fast";
    riskProfile: "conservative" | "balanced" | "aggressive";
    correctnessPriority: "strict" | "high" | "normal";
    timeSensitivity: "low" | "adaptive" | "high";
  };

  // 5. LLM routing influence (hints, never overrides correctness)
  routingHints?: {
    preferredModelTier?: "cheap" | "balanced" | "premium";
    preferredReasoningMode?: "structured" | "chain-of-thought" | "bullets";
    allowDegradationUnderUrgency?: boolean;
  };

  // 6. Memory influence (light-touch, high-signal)
  memoryPolicy?: {
    retentionBias?: "patterns" | "tactics" | "decisions" | "mixed";
    compressionStyle?: "high-signal" | "narrative" | "checklist";
  };

  // 7. Autonomy influence (cunning, not an overthinker)
  autonomyPolicy?: {
    planningBias: "low" | "medium" | "high";
    reflectionBias: "low" | "medium" | "high";
    actionBias: "low" | "medium" | "high";
  };
};

/**
 * Fallback operator profile — used when no operator core is found.
 */
const FALLBACK_PROFILE: OperatorProfile = {
  name: "general",
  domain: "general",
  mission:
    "Provide clear, grounded, constraint-aware reasoning across domains when no specific operator is defined.",

  principles: [
    "Clarity over cleverness.",
    "Respect constraints: time, energy, capital, attention.",
    "Prefer simple, robust solutions over fragile complexity."
  ],

  constraints: [
    "Do not hallucinate expertise you do not have.",
    "Avoid overpromising outcomes without clear pathways."
  ],

  heuristics: [
    "If the problem is unclear, clarify it before solving.",
    "If the plan depends on perfect behavior, it will fail."
  ],

  questions: [
    "What is the real problem behind this question?",
    "What constraints are actually binding right now?"
  ],

  tonePolicy: {
    defaultTone: "precise",
    underUrgencyTone: "compressed"
  },

  decisionProfile: {
    depthBias: "deep",
    speedBias: "balanced",
    riskProfile: "balanced",
    correctnessPriority: "high",
    timeSensitivity: "adaptive"
  },

  routingHints: {
    preferredModelTier: "balanced",
    preferredReasoningMode: "structured",
    allowDegradationUnderUrgency: true
  },

  memoryPolicy: {
    retentionBias: "patterns",
    compressionStyle: "high-signal"
  },

  autonomyPolicy: {
    planningBias: "medium",
    reflectionBias: "medium",
    actionBias: "medium"
  }
};

/**
 * Load operator profile from operator cores.
 */
export function getOperatorProfile(name: string): OperatorProfile {
  const core = operatorCoresByName[name];
  if (!core) return FALLBACK_PROFILE;

  return {
    name: core.name,
    domain: core.domain,
    mission: core.mission,

    principles: core.principles,
    constraints: core.constraints,
    heuristics: core.heuristics,
    questions: core.questions,

    tonePolicy: core.tonePolicy,
    decisionProfile: core.decisionProfile,
    routingHints: core.routingHints,
    memoryPolicy: core.memoryPolicy,
    autonomyPolicy: core.autonomyPolicy
  };
}
