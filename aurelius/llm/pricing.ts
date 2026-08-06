// aurelius/llm/pricing.ts
//
// WHAT AURELIUS COSTS TO RUN.
//
// Every engine already reported a token count and every call already wrote a
// LogEntry — and then the number was thrown away. Nothing priced it, nothing
// summed it, nothing warned. That was survivable while the spine was small; it
// stopped being survivable once the curriculum went to 2 units × 7 fields a
// week and inbox triage joined the daily schedule.
//
// THE HONESTY RULES HERE MATTER MORE THAN THE NUMBERS:
//
//   1. An unknown model prices to NULL, never to zero. A zero silently
//      understates the bill and reads identically to "this call was free."
//      Unpriced calls are counted and reported AS unpriced.
//   2. Prices are ESTIMATES, dated below, maintained by hand. They are not
//      fetched from a billing API, so they drift. Treat the total as "the
//      right order of magnitude and the right ranking between jobs" — for the
//      actual bill, read the provider console. Every surface that shows a
//      dollar figure says so.
//   3. Input and output are priced separately because output costs roughly
//      4–5× input. Summing them into one number (which is what every engine
//      used to return) makes the estimate wrong by a large factor in either
//      direction depending on the shape of the call.
//   4. CACHED input is priced separately again. The Anthropic adapter marks
//      the static half of the prompt with cache_control, so on a warm cache
//      most input tokens bill at ~10%. Ignoring that would overstate the cost
//      of exactly the calls the caching was built to make cheap.

/**
 * When these numbers were last checked by hand. Shown wherever cost is.
 *
 * CONFIDENCE, honestly stated: the Anthropic rows were checked against
 * published pricing on this date. The OpenAI / Google / Groq / DeepSeek / xAI
 * rows have NOT been verified since they were written and should be treated as
 * rough. If a provider's spend starts mattering, verify its row before
 * trusting the figure — and the provider console is always the real answer.
 */
export const PRICES_AS_OF = "2026-08-06";

export type ModelPrice = {
  /** USD per 1M input tokens. */
  inPer1M: number;
  /** USD per 1M output tokens. */
  outPer1M: number;
  /** USD per 1M cached-read input tokens. Defaults to 10% of input. */
  cachedInPer1M?: number;
};

/**
 * Prefix-matched so a new point release (claude-sonnet-5-20260901) still
 * prices under its family instead of falling off the table. Longest matching
 * prefix wins, so a specific entry can override a family.
 */
const PRICES: Record<string, ModelPrice> = {
  // ── Anthropic ──
  // CORRECTED 2026-08-06. The first pass of this table was written from
  // memory and was wrong in BOTH directions — opus at 15/75 (3x too high)
  // and fable at 3/15 (3x too low, when it is the most expensive model on
  // the list). That is precisely why rule 2 above exists: a hand-maintained
  // table drifts, and a confidently wrong number is worse than an absent one.
  "claude-opus": { inPer1M: 5, outPer1M: 25 },
  // Sonnet 5 runs at an introductory $2/$10 through 2026-08-31 and returns to
  // the standard $3/$15 on 2026-09-01. The standard rate is encoded, so for
  // the remainder of August this OVERSTATES sonnet spend slightly. Erring
  // high is the right direction for a budget alarm — it warns early, never late.
  "claude-sonnet": { inPer1M: 3, outPer1M: 15 },
  "claude-haiku": { inPer1M: 1, outPer1M: 5 },
  "claude-fable": { inPer1M: 10, outPer1M: 50 },
  "claude-3-5-haiku": { inPer1M: 1, outPer1M: 5 },
  "claude-3-5-sonnet": { inPer1M: 3, outPer1M: 15 },

  // ── OpenAI ──
  "gpt-4o-mini": { inPer1M: 0.15, outPer1M: 0.6 },
  "gpt-4o": { inPer1M: 2.5, outPer1M: 10 },
  "gpt-4.1-mini": { inPer1M: 0.4, outPer1M: 1.6 },
  "gpt-4.1": { inPer1M: 2, outPer1M: 8 },
  "o4-mini": { inPer1M: 1.1, outPer1M: 4.4 },

  // ── Google ──
  "gemini-2.5-pro": { inPer1M: 1.25, outPer1M: 10 },
  "gemini-2.5-flash": { inPer1M: 0.3, outPer1M: 2.5 },
  "gemini-2.0-flash": { inPer1M: 0.1, outPer1M: 0.4 },
  "gemini-1.5-pro": { inPer1M: 1.25, outPer1M: 5 },
  "gemini-1.5-flash": { inPer1M: 0.075, outPer1M: 0.3 },

  // ── Groq (fast + cheap; the failover tier) ──
  "llama-3.3-70b": { inPer1M: 0.59, outPer1M: 0.79 },
  "llama-3.1-8b": { inPer1M: 0.05, outPer1M: 0.08 },
  "llama": { inPer1M: 0.59, outPer1M: 0.79 },

  // ── DeepSeek ──
  "deepseek-reasoner": { inPer1M: 0.55, outPer1M: 2.19 },
  "deepseek": { inPer1M: 0.27, outPer1M: 1.1 },

  // ── xAI ──
  "grok-4": { inPer1M: 3, outPer1M: 15 },
  "grok": { inPer1M: 2, outPer1M: 10 },
};

/** Calls that never hit a provider — the compiled-reuse cache. Genuinely free. */
const FREE_MODELS = new Set(["reasoning_cache", "compiled"]);

/** Longest-prefix lookup. Null when the model isn't on the table. */
export function priceFor(model: string | undefined | null): ModelPrice | null {
  const m = (model ?? "").trim().toLowerCase();
  if (!m) return null;
  if (FREE_MODELS.has(m)) return { inPer1M: 0, outPer1M: 0 };
  let best: { key: string; price: ModelPrice } | null = null;
  for (const [key, price] of Object.entries(PRICES)) {
    if (m.startsWith(key) && (!best || key.length > best.key.length)) best = { key, price };
  }
  return best?.price ?? null;
}

export type TokenUsage = {
  tokensIn?: number;
  tokensOut?: number;
  /** Input tokens served from the prompt cache — billed at a fraction. */
  tokensCachedIn?: number;
};

/**
 * USD for one call. Null when the model isn't priced — the caller must carry
 * that through as "unpriced" rather than substituting zero.
 */
export function costUsd(model: string | undefined | null, usage: TokenUsage): number | null {
  const price = priceFor(model);
  if (!price) return null;
  const cached = Math.max(0, usage.tokensCachedIn ?? 0);
  // tokensIn is the FULL input count; cached reads are the discounted subset.
  const fresh = Math.max(0, (usage.tokensIn ?? 0) - cached);
  const cachedRate = price.cachedInPer1M ?? price.inPer1M * 0.1;
  return (
    (fresh * price.inPer1M) / 1_000_000 +
    (cached * cachedRate) / 1_000_000 +
    ((usage.tokensOut ?? 0) * price.outPer1M) / 1_000_000
  );
}

/** Money, at a precision that doesn't pretend to be exact. */
export function formatUsd(amount: number): string {
  if (amount === 0) return "$0.00";
  if (amount < 0.01) return `<$0.01`;
  if (amount < 10) return `$${amount.toFixed(2)}`;
  return `$${amount.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

/** The monthly ceiling Cole set, if any. Unset = tracking only, no alarm. */
export function monthlyBudgetUsd(): number | null {
  const raw = process.env.LLM_MONTHLY_BUDGET_USD?.trim();
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}
