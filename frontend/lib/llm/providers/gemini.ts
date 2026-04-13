// ===============================================
// AURELIUS OS 3.4 — GEMINI PROVIDER
// Gemini 1.5 / Gemini Flash support
// ===============================================

import { LLMProvider, LLMProviderConfig, LLMRequest, LLMResponse } from "./base";

const config: LLMProviderConfig = {
  apiKey: process.env.GEMINI_API_KEY || "",
  baseUrl: process.env.GEMINI_BASE_URL || "https://generativelanguage.googleapis.com/v1beta/models",
};

export const geminiProvider: LLMProvider = {
  name: "gemini",

  async call(request: LLMRequest): Promise<LLMResponse> {
    if (!config.apiKey) {
      throw new Error("GEMINI_API_KEY is not set");
    }

    const res = await fetch(
      `${config.baseUrl}/${request.model}:generateContent?key=${config.apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: request.messages.map((m) => ({
            role: m.role,
            parts: [{ text: m.content }],
          })),
          generationConfig: {
            maxOutputTokens: request.maxTokens ?? 2048,
            temperature: request.temperature ?? 0.7,
          },
        }),
      }
    );

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Gemini error: ${res.status} ${text}`);
    }

    const json: any = await res.json();
    const content = json.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    return { content, raw: json };
  },
};
