/**
 * anthropicEngine.ts
 * Aurelius OS — Claude API adapter.
 * Supports any current Claude model (Sonnet, Opus, Haiku).
 * Respects the model passed in by the router.
 */
import type { EngineAdapter } from "./engineAdapter.ts";
import { REQUEST_TIMEOUT_MS, fetchWithRetry } from "./engineAdapter.ts";
import { CACHE_BREAK } from "../llm/promptMarkers.ts";

type RunAnthropicInput = {
  model?: string;
  systemPrompt?: string;
  userPrompt: string;
  maxTokens?: number;
  tools?: any[]; // Anthropic-shaped tool definitions (router supplies)
};

async function runAnthropic({
  model = "claude-sonnet-5",
  systemPrompt,
  userPrompt,
  maxTokens = 8192,
  tools,
}: RunAnthropicInput): Promise<{
  text: string;
  tokensUsed: number;
  tokensIn?: number;
  tokensOut?: number;
  tokensCachedIn?: number;
  raw: any;
}> {
  // TRIM (Cole's Railway deploy: Anthropic silently failing over to OpenAI).
  // Pasting a key into a hosting dashboard picks up a trailing newline or
  // stray space astonishingly often; sending it verbatim yields a 401
  // "invalid x-api-key" that looks exactly like a dead provider. Strip
  // whitespace and any wrapping quotes before it can cost a failover.
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim().replace(/^["']|["']$/g, "");
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
  if (systemPrompt) {
    // Prompt caching (final council): the router assembles a static prefix
    // (persona/identity/operators/tool catalog) above CACHE_BREAK and live
    // context below it. Marking the prefix block with cache_control turns
    // ~8K tokens per call into 90%-discounted cache reads. Prompts without
    // the marker (raw callers) ship as a plain string, exactly as before.
    const at = systemPrompt.indexOf(CACHE_BREAK);
    if (at > 0) {
      body.system = [
        { type: "text", text: systemPrompt.slice(0, at), cache_control: { type: "ephemeral" } },
        { type: "text", text: systemPrompt.slice(at) },
      ];
    } else {
      body.system = systemPrompt;
    }
  }
  if (tools?.length) body.tools = tools;

  try {
    const res = await fetchWithRetry("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
      // fetchWithRetry (6.4) owns the timeout AND backs off on a transient 429/
      // 529/5xx before the router fails over to a lesser provider — an overloaded
      // Anthropic gets a couple of backed-off tries, not an instant demotion.
    }, { timeoutMs: REQUEST_TIMEOUT_MS });

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

    // Claude returns content as an ARRAY of blocks. Concatenate every text
    // block — reading only content[0].text drops the reply whenever a non-text
    // block (e.g. thinking/tool_use) comes first, which surfaces as an empty
    // answer even though tokens were spent.
    let text = "";
    if (Array.isArray(json?.content)) {
      text = json.content
        .filter((b: any) => b?.type === "text" && typeof b?.text === "string")
        .map((b: any) => b.text)
        .join("")
        .trim();
    } else if (typeof json?.content?.[0]?.text === "string") {
      text = json.content[0].text;
    }

    if (!text && json?.stop_reason !== "tool_use") {
      // Diagnostic: when the model spent tokens but we got no text, show why.
      // (A pure tool_use turn legitimately has no text — the router reads the
      // tool calls from `raw`, so that's not worth a warning.)
      console.warn(
        "[ANTHROPIC] empty text extracted — block types:",
        Array.isArray(json?.content) ? json.content.map((b: any) => b?.type) : typeof json?.content,
        "· stop_reason:",
        json?.stop_reason
      );
    }

    // Split in/out, and keep cache reads separate. Output bills ~5x input,
    // and cached input bills ~10% of input — the summed total this used to
    // return could not price either correctly.
    const tokensIn =
      (json?.usage?.input_tokens || 0) +
      (json?.usage?.cache_read_input_tokens || 0) +
      (json?.usage?.cache_creation_input_tokens || 0);
    const tokensOut = json?.usage?.output_tokens || 0;
    const tokensCachedIn = json?.usage?.cache_read_input_tokens || 0;
    const tokensUsed = tokensIn + tokensOut;

    return { text, tokensUsed, tokensIn, tokensOut, tokensCachedIn, raw: json };
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
      tools: request.tools,
    });
    return {
      text: result.text,
      tokensUsed: result.tokensUsed,
      tokensIn: result.tokensIn,
      tokensOut: result.tokensOut,
      tokensCachedIn: result.tokensCachedIn,
      raw: result.raw,
    };
  },
};