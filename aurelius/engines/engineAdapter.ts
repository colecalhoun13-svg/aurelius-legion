// aurelius/engines/engineAdapter.ts

/**
 * Hard ceiling on any single provider call.
 *
 * Deploy-triage finding: five of the six adapters called raw `fetch()` with no
 * signal. Failover only fires on a RETURNED error string, so a provider that
 * accepted the connection and then stalled hung `routeLLM` forever — the 07:00
 * briefing would never complete and never log a thing. Two minutes is well past
 * the slowest legitimate reasoning turn (deepseek-reasoner on a long prompt) and
 * well short of "silently dead". Override per-deploy with LLM_TIMEOUT_MS.
 */
export const REQUEST_TIMEOUT_MS = Math.max(
  15_000,
  Number(process.env.LLM_TIMEOUT_MS) || 120_000
);

// Transient HTTP statuses worth retrying the SAME provider before failing over
// to a different (possibly worse) one. 429 = rate limit, 529 = Anthropic
// overloaded, 5xx = provider hiccup. A 400/401/404 is our bug, not theirs — no
// retry.
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 529]);
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * fetch with a per-attempt timeout AND exponential backoff on transient errors
 * (6.4). The router does cross-provider failover, not retry — so a single
 * overloaded-529 on the primary used to bounce straight to a lesser model. This
 * gives the primary a couple of backed-off tries first (honouring Retry-After
 * when present), which is what a correlated rate-limit spike actually needs.
 */
export async function fetchWithRetry(
  url: string,
  init: RequestInit = {},
  opts: { attempts?: number; timeoutMs?: number } = {}
): Promise<Response> {
  const attempts = Math.max(1, opts.attempts ?? 3);
  const timeoutMs = opts.timeoutMs ?? REQUEST_TIMEOUT_MS;
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...init, signal: ctrl.signal });
      clearTimeout(timer);
      if (RETRYABLE_STATUS.has(res.status) && i < attempts - 1) {
        const retryAfter = Number(res.headers.get("retry-after"));
        const wait = Number.isFinite(retryAfter) && retryAfter > 0
          ? Math.min(retryAfter * 1000, 20_000)
          : 2 ** i * 500 + Math.floor(Math.random() * 250); // exp backoff + jitter
        await sleep(wait);
        continue;
      }
      return res;
    } catch (err) {
      clearTimeout(timer);
      lastErr = err;
      if (i < attempts - 1) {
        await sleep(2 ** i * 500 + Math.floor(Math.random() * 250));
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

export type EngineRequest = {
  model: string;
  systemPrompt?: string;
  userPrompt: string;
  tools?: any[];
  context?: any;
};

export type EngineResponse = {
  text: string;
  /** in + out. Kept for every existing caller. */
  tokensUsed: number;
  // Split counts, because output bills ~5x input and cached input bills ~10%
  // of it — a single total cannot be priced. Optional: an adapter that can't
  // report the split leaves them undefined and its calls report as UNPRICED
  // rather than silently costing zero.
  tokensIn?: number;
  tokensOut?: number;
  /** Input tokens served from the provider's prompt cache. */
  tokensCachedIn?: number;
  raw?: any;
};

export interface EngineAdapter {
  name: string;
  run(request: EngineRequest): Promise<EngineResponse>;
}
