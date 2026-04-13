// ===============================================
// AURELIUS OS 3.4 — DEEPSEEK PROVIDER
// Uses env: DEEPSEEK_API_KEY, DEEPSEEK_BASE_URL (optional).
// ===============================================

import { LLMProvider, LLMProviderConfig, LLMRequest, LLMResponse } from "./base";

const config: LLMProviderConfig = {
  apiKey: process.env.DEEPSEEK_API_KEY || "",
  baseUrl: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/v1",
};

export const deepseekProvider: LLMProvider = {
  name: "deepseek",
  async call(request: LLMRequest): Promise<LLMResponse> {
    if (!config.apiKey) {
      throw new Error("DEEPSEEK_API_KEY is not set");
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
        temperature: request.temperature ?? 0.6,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`DeepSeek error: ${res.status} ${text}`);
    }

    const json: any = await res.json();
    const content = json.choices?.[0]?.message?.content ?? "";

    return { content, raw: json };
  },
};
