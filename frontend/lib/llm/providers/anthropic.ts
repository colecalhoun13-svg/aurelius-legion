// ===============================================
// AURELIUS OS 3.4 — ANTHROPIC PROVIDER
// Claude 3.x / Claude 3.5 support
// ===============================================

import { LLMProvider, LLMProviderConfig, LLMRequest, LLMResponse } from "./base";

const config: LLMProviderConfig = {
  apiKey: process.env.ANTHROPIC_API_KEY || "",
  baseUrl: process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com/v1/messages",
};

export const anthropicProvider: LLMProvider = {
  name: "anthropic",

  async call(request: LLMRequest): Promise<LLMResponse> {
    if (!config.apiKey) {
      throw new Error("ANTHROPIC_API_KEY is not set");
    }

    const systemMessage = request.messages.find((m) => m.role === "system");
    const userMessages = request.messages.filter((m) => m.role !== "system");

    const res = await fetch(config.baseUrl, {
      method: "POST",
      headers: {
        "x-api-key": config.apiKey,
        "Content-Type": "application/json",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: request.model,
        system: systemMessage?.content,
        messages: userMessages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        max_tokens: request.maxTokens ?? 2048,
        temperature: request.temperature ?? 0.7,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Anthropic error: ${res.status} ${text}`);
    }

    const json: any = await res.json();
    const content = json.content?.[0]?.text ?? "";

    return { content, raw: json };
  },
};
