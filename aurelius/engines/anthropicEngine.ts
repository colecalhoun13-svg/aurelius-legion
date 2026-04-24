/**
 * anthropicEngine.ts
 * Aurelius OS — Claude API adapter.
 * Supports any current Claude model (Sonnet, Opus, Haiku).
 * Respects the model passed in by the router.
 */
import type { EngineAdapter } from "./engineAdapter.ts";

type RunAnthropicInput = {
  model?: string;
  systemPrompt?: string;
  userPrompt: string;
  maxTokens?: number;
};

async function runAnthropic({
  model = "claude-sonnet-4-6",
  systemPrompt,
  userPrompt,
  maxTokens = 4096,
}: RunAnthropicInput): Promise<{ text: string; tokensUsed: number; raw: any }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      text: "Anthropic engine is not configured. Missing ANTHROPIC_API_KEY.",
      tokensUsed: 0,
      raw: null,
    };
  }

  const body: any = {
    model,
    messages: [{ role: "user", content: userPrompt }],
    max_tokens: maxTokens,
  };
  if (systemPrompt) body.system = systemPrompt;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });

    const json = await res.json();

    if (!res.ok) {
      const errMsg = json?.error?.message || `HTTP ${res.status}`;
      console.error(`[ANTHROPIC] API error: ${errMsg}`, json);
      return {
        text: `Anthropic API error: ${errMsg}`,
        tokensUsed: 0,
        raw: json,
      };
    }

    const text = json?.content?.[0]?.text ?? "";
    const tokensUsed =
      (json?.usage?.input_tokens || 0) + (json?.usage?.output_tokens || 0);

    return { text, tokensUsed, raw: json };
  } catch (err: any) {
    console.error("[ANTHROPIC] Fetch error:", err);
    return {
      text: `Anthropic engine encountered an error: ${err?.message || String(err)}`,
      tokensUsed: 0,
      raw: null,
    };
  }
}

export const anthropicAdapter: EngineAdapter = {
  name: "anthropic",
  async run(request) {
    const result = await runAnthropic({
      model: request.model,
      systemPrompt: request.systemPrompt,
      userPrompt: request.userPrompt,
    });
    return {
      text: result.text,
      tokensUsed: result.tokensUsed,
      raw: result.raw,
    };
  },
};