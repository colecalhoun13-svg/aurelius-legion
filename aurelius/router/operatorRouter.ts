// aurelius/router/operatorRouter.ts
//
// Aurelius OS — Multi-Operator Routing
//
// Returns a primary operator (the dominant lens) plus optional secondaries
// (operators whose constraints/principles also apply to the request).
//
// Domain operators (training, business, etc.) can be primary OR secondary.
// Workflow operators (weeklyPlanning, scheduling, etc.) can ONLY be primary —
// they're task contexts, not lenses that contribute to other conversations.

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

export type OperatorRouting = {
  primary: string;
  secondaries: string[];
  scores: Record<string, number>; // for debugging/visibility
};

// ═══════════════════════════════════════════════════════════════════
// OPERATOR CLASSIFICATION
// ═══════════════════════════════════════════════════════════════════

const DOMAIN_OPERATORS = [
  "strategy",
  "athlete",
  "training",
  "business",
  "wealth",
  "content",
  "identity",
] as const;

const WORKFLOW_OPERATORS = [
  "dailyPlanning",
  "weeklyPlanning",
  "scheduling",
  "accountability",
  "goal",
  "tasks",
  "research",
  "reflection",
  "finance",
] as const;

const ALL_OPERATORS = [...DOMAIN_OPERATORS, ...WORKFLOW_OPERATORS];

const SECONDARY_THRESHOLD = 0.6; // secondary must score >= 60% of primary's score
const MAX_SECONDARIES = 2;

// ═══════════════════════════════════════════════════════════════════
// KEYWORD SCORING
// Each operator has a keyword set. Multi-keyword matches stack the score.
// Higher base value = stronger keyword. Plurals/variants included where useful.
// ═══════════════════════════════════════════════════════════════════

type KeywordSet = {
  strong: string[];   // contributes 0.4 per match
  medium: string[];   // contributes 0.25 per match
  weak: string[];     // contributes 0.1 per match
};

const KEYWORDS: Record<string, KeywordSet> = {
  // ── Domain operators ───────────────────────────────────────────────
  strategy: {
    strong: ["strategy", "strategic", "leverage", "compounding"],
    medium: ["plan", "planning", "systems", "approach", "longterm", "long-term"],
    weak: ["think", "thinking", "tradeoff", "decision"],
  },
  training: {
    strong: ["training", "workout", "lift", "lifting", "hypertrophy", "strength", "powerlifting"],
    medium: ["trains", "session", "rep", "reps", "set", "sets", "block", "program", "programming"],
    weak: ["athlete", "muscle", "gym", "tempo", "deload"],
  },
  athlete: {
    strong: ["athlete", "athletic", "competition", "competing"],
    medium: ["recovery", "performance", "conditioning"],
    weak: ["fatigue", "form"],
  },
  business: {
    strong: ["business", "offer", "client", "clients", "revenue", "sales"],
    medium: ["customer", "marketing", "funnel", "pricing", "launch"],
    weak: ["money", "growth"],
  },
  wealth: {
    strong: ["wealth", "investment", "investing", "portfolio", "asset", "assets"],
    medium: ["invest", "capital", "savings", "stocks", "crypto"],
    weak: ["money", "financial"],
  },
  content: {
    strong: ["content", "caption", "script", "post", "video", "hook"],
    medium: ["write", "writing", "instagram", "ig", "tiktok", "youtube"],
    weak: ["create", "creator", "audience"],
  },
  identity: {
    strong: ["identity", "purpose", "values", "who am i"],
    medium: ["self", "core", "mission"],
    weak: ["meaning", "becoming"],
  },

  // ── Workflow operators (primary-only) ──────────────────────────────
  weeklyPlanning: {
    strong: ["weekly planning", "this week", "week ahead", "plan my week"],
    medium: ["weekly", "this weeks", "week's"],
    weak: [],
  },
  dailyPlanning: {
    strong: ["daily planning", "today's plan", "plan today", "morning briefing"],
    medium: ["today", "tomorrow", "morning"],
    weak: ["agenda"],
  },
  scheduling: {
    strong: ["schedule", "calendar", "appointment", "book"],
    medium: ["timeslot", "available", "free time"],
    weak: ["when", "time"],
  },
  accountability: {
    strong: ["hold me accountable", "check in on me", "remind me", "accountability"],
    medium: ["follow up", "track progress"],
    weak: [],
  },
  goal: {
    strong: ["goal", "goals", "target", "objective", "milestone"],
    medium: ["aim", "achieving"],
    weak: ["want to"],
  },
  tasks: {
    strong: ["task", "tasks", "todo", "to-do", "to do list"],
    medium: ["checklist", "do list"],
    weak: ["item"],
  },
  finance: {
    strong: ["budget", "expense", "expenses", "cashflow", "spending"],
    medium: ["bills", "income", "tax", "taxes"],
    weak: ["payment", "cost"],
  },
  research: {
    strong: ["research", "find me", "look up", "investigate"],
    medium: ["study", "studies", "literature", "source"],
    weak: ["learn about", "explain"],
  },
  reflection: {
    strong: ["reflect", "reflection", "journal", "looking back"],
    medium: ["thoughts on", "lessons", "review the"],
    weak: ["how did", "what went"],
  },
};

// ═══════════════════════════════════════════════════════════════════
// SCORING
// ═══════════════════════════════════════════════════════════════════

function scoreOperator(message: string, operator: string): number {
  const kws = KEYWORDS[operator];
  if (!kws) return 0;

  const lower = message.toLowerCase();
  let score = 0;

  for (const kw of kws.strong) {
    if (lower.includes(kw)) score += 0.4;
  }
  for (const kw of kws.medium) {
    if (lower.includes(kw)) score += 0.25;
  }
  for (const kw of kws.weak) {
    if (lower.includes(kw)) score += 0.1;
  }

  // Cap at 1.0 to keep scores comparable
  return Math.min(score, 1.0);
}

// ═══════════════════════════════════════════════════════════════════
// MAIN ROUTING
// ═══════════════════════════════════════════════════════════════════

export function routeOperators(message: string): OperatorRouting {
  // Score every operator
  const scores: Record<string, number> = {};
  for (const op of ALL_OPERATORS) {
    scores[op] = scoreOperator(message, op);
  }

  // Find primary (highest score). Default to "strategy" if nothing scored.
  let primary = "strategy";
  let primaryScore = 0;

  for (const op of ALL_OPERATORS) {
    if (scores[op] > primaryScore) {
      primaryScore = scores[op];
      primary = op;
    }
  }

  // If nothing scored at all, return strategy as primary, no secondaries
  if (primaryScore === 0) {
    return { primary, secondaries: [], scores };
  }

  // Find secondaries:
  //  — must be DOMAIN operators only (workflow operators are primary-only)
  //  — must score >= threshold * primary score
  //  — must not be the primary itself
  //  — capped at MAX_SECONDARIES, sorted by score desc
  const minSecondaryScore = primaryScore * SECONDARY_THRESHOLD;

  const secondaries = DOMAIN_OPERATORS
    .filter((op) => op !== primary && scores[op] >= minSecondaryScore && scores[op] > 0)
    .sort((a, b) => scores[b] - scores[a])
    .slice(0, MAX_SECONDARIES);

  return { primary, secondaries: [...secondaries], scores };
}

// ═══════════════════════════════════════════════════════════════════
// LEGACY COMPATIBILITY
// Keep routeOperator() working so we don't break existing code during
// the migration. Returns just the primary string.
// ═══════════════════════════════════════════════════════════════════

export function routeOperator(message: string): string {
  return routeOperators(message).primary;
}