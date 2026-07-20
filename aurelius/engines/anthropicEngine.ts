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
  tools?: any[]; // Anthropic-shaped tool definitions (router supplies)
};

async function runAnthropic({
  model = "claude-sonnet-5",
  systemPrompt,
  userPrompt,
  maxTokens = 8192,
  tools,
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
  if (tools?.length) body.tools = tools;

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
      tools: request.tools,
    });
    return {
      text: result.text,
      tokensUsed: result.tokensUsed,
      raw: result.raw,
    };
  },
};