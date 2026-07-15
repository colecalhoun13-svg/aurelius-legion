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
//
// TWO routers live here:
//   • routeOperators(message)          — synchronous, keyword-only. The anchor.
//   • routeOperatorsSemantic(message)  — async, BLENDS embedding similarity with
//     the keyword score (master-class #6). Semantics catch what literal keywords
//     miss ("how do I get more jacked" → training, with no keyword hit), while
//     the keyword anchor keeps unambiguous requests reliable. Falls back to pure
//     keyword when embeddings are disabled OR the provider is "mock" (a hash —
//     similar texts do NOT map to similar vectors, so its cosine is noise).

import { getEmbeddingAdapter, type EmbeddingAdapter } from "../retrieval/embeddingAdapter.ts";

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

// Pick primary + secondaries from a finished score table. Shared by the
// keyword router and the semantic router so both obey the same selection rules
// (workflow ops are primary-only; secondaries are domain-only, threshold-gated).
function selectFromScores(scores: Record<string, number>): OperatorRouting {
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

export function routeOperators(message: string): OperatorRouting {
  const scores: Record<string, number> = {};
  for (const op of ALL_OPERATORS) {
    scores[op] = scoreOperator(message, op);
  }
  return selectFromScores(scores);
}

// ═══════════════════════════════════════════════════════════════════
// SEMANTIC ROUTING (master-class #6)
// Each operator carries a natural-language profile — its mission plus its
// vocabulary field. We embed those once (cached per adapter), embed the
// message, and score by cosine similarity. Blended with the keyword score so
// the literal anchors still win when they're unambiguous.
// ═══════════════════════════════════════════════════════════════════

// Profiles grounded in operatorCores.ts missions (domain ops) and the keyword
// intent above (workflow ops) — NOT invented. This is the text the router
// "understands" each operator to be about.
const OPERATOR_PROFILES: Record<string, string> = {
  strategy:
    "Strategy and long-term thinking: turning vague ambition into a sequenced, constraint-aware plan that compounds over quarters and years. Leverage, systems, tradeoffs, prioritization, deciding what to ignore on purpose, protecting the downside.",
  training:
    "Physical training and lifting: designing workout programs, hypertrophy and strength blocks, sets, reps, tempo, deloads, powerlifting, progressive overload, programming a training session, getting stronger and more muscular.",
  athlete:
    "Athletic performance and competition: recovery, conditioning, managing fatigue, peaking for a competition, expressing strength, speed, and power on demand.",
  business:
    "Business building: offers, clients, revenue, sales, marketing, funnels, pricing, launches — turning skills and assets into a focused, profitable, scalable business with clean operations.",
  wealth:
    "Wealth and investing: allocating capital, portfolios, assets, stocks, crypto, savings — building durable, compounding wealth with controlled downside over the long run.",
  content:
    "Content creation: captions, scripts, hooks, posts, videos, writing for Instagram, TikTok, and YouTube — turning lived insight into resonant content that attracts the right audience.",
  identity:
    "Identity and purpose: values, self-concept, who I am and who I'm becoming, aligning behavior and environment with the person I want to be, meaning and mission.",
  weeklyPlanning:
    "Planning the week ahead: mapping out this week's priorities, structuring the coming days, deciding what matters across the week.",
  dailyPlanning:
    "Planning today: the morning briefing, today's plan and agenda, what to get done today or tomorrow.",
  scheduling:
    "Scheduling and calendar: booking appointments, finding available timeslots and free time, putting something on the calendar at a specific time.",
  accountability:
    "Accountability: holding me accountable, checking in on my progress, reminders and follow-ups on the commitments I made.",
  goal:
    "Goals and targets: setting objectives and milestones, defining what I'm aiming to achieve.",
  tasks:
    "Tasks and to-dos: managing a task list, todos, checklists, individual action items to knock out.",
  finance:
    "Personal finance and budgeting: budgets, expenses, cashflow, spending, bills, income, taxes — day-to-day money management.",
  research:
    "Research: finding and looking up information, investigating a topic, digging into studies, literature, and sources to learn about something.",
  reflection:
    "Reflection: journaling, looking back, reviewing how something went, drawing lessons and thoughts from past experience.",
};

// Blend weights — semantic leads, keyword anchors. Tuned so a strong literal
// keyword hit (score ~0.4–1.0) can still overrule a merely-plausible semantic
// lean, while a clear semantic match with no keyword still routes correctly.
const SEM_WEIGHT = 0.55;
const KW_WEIGHT = 0.45;

// Operator profile vectors are static; embed them once per adapter (the model
// can change between mock/openai/gemini, so key the cache by adapter identity).
let profileCache: { key: string; vectors: Record<string, number[]> } | null = null;

async function getProfileVectors(adapter: EmbeddingAdapter): Promise<Record<string, number[]>> {
  const key = `${adapter.name}:${adapter.model}`;
  if (profileCache && profileCache.key === key) return profileCache.vectors;
  const texts = ALL_OPERATORS.map((op) => OPERATOR_PROFILES[op]);
  const vecs = await adapter.embed(texts);
  const vectors: Record<string, number[]> = {};
  ALL_OPERATORS.forEach((op, i) => { vectors[op] = vecs[i]!; });
  profileCache = { key, vectors };
  return vectors;
}

function cosine(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

// Cosine → a 0..1 score comparable to keyword scores. We normalize against the
// best-matching operator (relative, not absolute), so the winner reads ~1.0 and
// the rest fall off proportionally; negatives clamp to 0.
async function semanticScores(message: string, adapter: EmbeddingAdapter): Promise<Record<string, number>> {
  const profiles = await getProfileVectors(adapter);
  const [msgVec] = await adapter.embed([message]);
  if (!msgVec) return {};

  const cos: Record<string, number> = {};
  let maxCos = 0;
  for (const op of ALL_OPERATORS) {
    const v = profiles[op];
    const c = v ? cosine(msgVec, v) : 0;
    cos[op] = c;
    if (c > maxCos) maxCos = c;
  }
  const denom = Math.max(maxCos, 1e-4);
  const norm: Record<string, number> = {};
  for (const op of ALL_OPERATORS) norm[op] = Math.max(0, cos[op]!) / denom;
  return norm;
}

/**
 * Semantic multi-operator routing. Blends embedding similarity with the keyword
 * score. Falls back to pure keyword routing when embeddings are unavailable, the
 * provider is "mock" (hash — not semantic), the message is empty, or the embed
 * call throws. Never louder than the keyword router on failure — just quieter.
 */
export async function routeOperatorsSemantic(message: string): Promise<OperatorRouting> {
  const kw: Record<string, number> = {};
  for (const op of ALL_OPERATORS) kw[op] = scoreOperator(message, op);

  const adapter = getEmbeddingAdapter();
  // Mock is a hash: its cosine is noise, so semantic routing would misfire.
  if (!adapter || adapter.name === "mock" || !message.trim()) {
    return selectFromScores(kw);
  }

  let sem: Record<string, number> | null = null;
  try {
    sem = await semanticScores(message, adapter);
  } catch (err: any) {
    console.warn("[operatorRouter] semantic routing failed — keyword fallback:", err?.message ?? err);
    sem = null;
  }
  if (!sem || Object.keys(sem).length === 0) return selectFromScores(kw);

  const blended: Record<string, number> = {};
  for (const op of ALL_OPERATORS) {
    blended[op] = SEM_WEIGHT * (sem[op] ?? 0) + KW_WEIGHT * (kw[op] ?? 0);
  }
  return selectFromScores(blended);
}

// ═══════════════════════════════════════════════════════════════════
// LEGACY COMPATIBILITY
// Keep routeOperator() working so we don't break existing code during
// the migration. Returns just the primary string.
// ═══════════════════════════════════════════════════════════════════

export function routeOperator(message: string): string {
  return routeOperators(message).primary;
}

// Is Cole asking for a real DECISION (vs. a fact, a chat, a task)? Decision turns
// get the application harness (Decision Mode) so the operator reasons THROUGH its
// frameworks instead of quoting them. Deliberately a touch eager — a false
// positive just asks the model to show its reasoning, which is rarely wrong.
const DECISION_RE =
  /\b(should i|should we|worth it|which\b|\bvs\.?\b|versus|better\b|best\b|do i|is it (smart|worth|wise|better)|go with|pick|choose|decide|deciding|trade[- ]?off|or should|what would you do|help me (decide|choose)|make the call)\b/i;

export function isDecisionQuery(message: string): boolean {
  return DECISION_RE.test(message ?? "");
}