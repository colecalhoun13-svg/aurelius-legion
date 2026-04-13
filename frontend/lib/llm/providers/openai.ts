// ===============================================
// AURELIUS OS 3.4 — OPENAI PROVIDER
// Uses env: OPENAI_API_KEY, OPENAI_BASE_URL (optional).
// ===============================================

import { LLMProvider, LLMProviderConfig, LLMRequest, LLMResponse } from "./base";

const config: LLMProviderConfig = {
  apiKey: process.env.OPENAI_API_KEY || "",
  baseUrl: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
};

export const openAIProvider: LLMProvider = {
  name: "openai",
  async call(request: LLMRequest): Promise<LLMResponse> {
    if (!config.apiKey) {
      throw new Error("OPENAI_API_KEY is not set");
    }

    const res = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: request.model,
        messages: request.messages,
        max_tokens: request.maxTokens,
        temperature: request.temperature ?? 0.7,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`OpenAI error: ${res.status} ${text}`);
    }

    const json: any = await res.json();
    const content = json.choices?.[0]?.message?.content ?? "";

    return { content, raw: json };
  },
};
