/**
 * deepseekEngine.ts
 * Aurelius OS v3.4 — DeepSeek R1 Engine Wiring
 */

import type { EngineAdapter } from "./engineAdapter.ts";

export async function runDeepSeek({ message, systemPrompt }) {
  const apiKey = process.env.DEEPSEEK_API_KEY;

  const body = {
    model: "deepseek-r1",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: message }
    ]
  };

  const res = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify(body)
  });

  const json = await res.json();
  return json.choices?.[0]?.message?.content ?? "";
}

export const deepseekAdapter: EngineAdapter = {
  name: "deepseek",
  async run(request) {
    const text = await runDeepSeek({
      message: request.userPrompt,
      systemPrompt: request.systemPrompt,
    });
    return {
      text,
      tokensUsed: 0,
    };
  },
};
