/**
 * anthropicEngine.ts
 * Aurelius OS v3.4 — Claude 3.5 Sonnet Engine Wiring
 */

import type { EngineAdapter, EngineResponse } from "./engineAdapter";

export async function runAnthropic({
  message,
  systemPrompt,
  maxTokens = 4096
}) {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    console.error("Anthropic API key missing (ANTHROPIC_API_KEY).");
    return "Anthropic engine is not configured. Missing API key.";
  }

  const body = {
    model: "claude-3-5-sonnet",
    system: systemPrompt,
    messages: [{ role: "user", content: message }],
    max_tokens: maxTokens
  };

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify(body)
    });

    const json = await res.json();

    // Anthropic always returns content as an array of blocks
    return json?.content?.[0]?.text ?? "";
  } catch (err) {
    console.error("Anthropic engine error:", err);
    return "Anthropic engine encountered an error while processing the request.";
  }
}

export const anthropicAdapter: EngineAdapter = {
  name: "anthropic",
  async run(request) {
    const text = await runAnthropic({
      message: request.userPrompt,
      systemPrompt: request.systemPrompt,
    });
    return {
      text,
      tokensUsed: 0,
    };
  },
};
