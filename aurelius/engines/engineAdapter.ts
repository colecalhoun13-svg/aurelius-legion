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

export type EngineRequest = {
  model: string;
  systemPrompt?: string;
  userPrompt: string;
  tools?: any[];
  context?: any;
};

export type EngineResponse = {
  text: string;
  tokensUsed: number;
  raw?: any;
};

export interface EngineAdapter {
  name: string;
  run(request: EngineRequest): Promise<EngineResponse>;
}
