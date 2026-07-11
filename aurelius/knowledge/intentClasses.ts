// aurelius/knowledge/intentClasses.ts
//
// Phase 4.5 — Intent class taxonomy for knowledge updates.
// Intent class = what Cole MEANS when he proposes a knowledge update.
// Compilation compiles per intent class, not per phrasing.

export type IntentClass = {
  id: string;
  operator: string;
  scope: string;
  description: string;
  examplePhrasings: string[];
};

export const TRAINING_INTENT_CLASSES: IntentClass[] = [
  {
    id: "rep_band_update",
    operator: "training",
    scope: "rep_bands",
    description: "Updates to rep band classifications (which rep counts mean which training intents)",
    examplePhrasings: [
      "split 6-7 into strength_endurance",
      "make 6-7 reps its own band",
      "1-3 should be power",
      "let's call 4-5 reps strength",
      "i want hypertrophy to be 8-14 reps",
    ],
  },
  {
    id: "intensity_zone_update",
    operator: "training",
    scope: "intensity_zones",
    description: "Updates to intensity zones (load as % of est 1RM mapped to training zones)",
    examplePhrasings: [
      "anything above 90% is max work",
      "intensification is 70-85%",
      "recovery zone should be under 50%",
      "let's call 85-95% peak intensity",
    ],
  },
  {
    id: "movement_pattern_update",
    operator: "training",
    scope: "movement_patterns",
    description: "Updates to exercise → movement pattern classification (split squat is unilateral, not bilateral)",
    examplePhrasings: [
      "front squats should count as squat pattern",
      "split squats are unilateral not bilateral squat",
      "power cleans are olympic not pull",
      "add hex bar deadlift to hinge pattern",
    ],
  },
  {
    id: "block_context_update",
    operator: "training",
    scope: "block_contexts",
    description: "Updates to block context categories (off-season, in-season, pre-camp, etc.)",
    examplePhrasings: [
      "add a pre-competition phase",
      "training camp prep counts as pre-camp",
      "peaking is its own block",
      "transition phase happens post-season",
    ],
  },
  {
    id: "fatigue_signal_update",
    operator: "training",
    scope: "fatigue_signals",
    description: "Updates to fatigue/deload signal markers (signals only — Cole owns decisions)",
    examplePhrasings: [
      "watch for 10% tonnage spikes",
      "RPE drift of 1+ point matters",
      "3 consecutive high-volume weeks is a marker",
      "bar speed drops should surface",
    ],
  },
];

// Cross-operator intent classes — not tied to one domain's scopes.
export const GENERAL_INTENT_CLASSES: IntentClass[] = [
  {
    id: "freshness_recheck",
    operator: "any",
    scope: "any",
    description:
      "Re-verification of a knowledge entry that has gone stale (past its scope's half-life). Confirming re-anchors it as current; correcting updates it; denying leaves it untouched.",
    examplePhrasings: [
      "yes that still holds",
      "that's outdated, it's actually ...",
      "keep it as is",
    ],
  },
  {
    id: "manual_correction",
    operator: "any",
    scope: "any",
    description:
      "Cole directly corrects something Aurelius said, compiled, or stored. Explicit Cole action — applies without a confirmation round-trip.",
    examplePhrasings: [
      "that's wrong — it's actually ...",
      "you misread that",
      "correct that entry",
    ],
  },
];

const ALL_INTENT_CLASSES = [...TRAINING_INTENT_CLASSES, ...GENERAL_INTENT_CLASSES];

export function getIntentClass(id: string): IntentClass | null {
  return ALL_INTENT_CLASSES.find((c) => c.id === id) ?? null;
}

export function getIntentClassesForOperator(operator: string): IntentClass[] {
  return TRAINING_INTENT_CLASSES.filter((c) => c.operator === operator);
}

export function getIntentClassByScope(operator: string, scope: string): IntentClass | null {
  return TRAINING_INTENT_CLASSES.find(
    (c) => c.operator === operator && c.scope === scope
  ) ?? null;
}

/**
 * Format intent classes for LLM prompt injection.
 */
export function formatIntentClassesForPrompt(operator: string): string {
  const classes = getIntentClassesForOperator(operator);
  if (classes.length === 0) return "";

  const lines: string[] = [
    "═══ KNOWLEDGE UPDATE INTENT CLASSES ═══",
    "When Cole proposes a knowledge update via natural language, classify into one of these:",
    "",
  ];
  for (const c of classes) {
    lines.push(`- ${c.id} (scope: ${c.scope})`);
    lines.push(`  ${c.description}`);
    lines.push(`  Example phrasings: ${c.examplePhrasings.slice(0, 2).map((p) => `"${p}"`).join(", ")}`);
    lines.push("");
  }
  return lines.join("\n");
}
