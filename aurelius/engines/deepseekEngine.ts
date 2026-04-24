// aurelius/engines/deepseekEngine.ts
import type { EngineAdapter, EngineRequest, EngineResponse } from "./engineAdapter.ts";

const DEEPSEEK_ENDPOINT = "https://api.deepseek.com/chat/completions";

export const deepseekAdapter: EngineAdapter = {
  name: "deepseek",
  async run(req: EngineRequest): Promise<EngineResponse> {
    const apiKey = process.env.DEEPSEEK_API_KEY || "";
    if (!apiKey) {
      return { text: "DEEPSEEK_API_KEY is not configured.", tokensUsed: 0 };
    }

    const body = {
      model: req.model || "deepseek-chat",
      messages: [
        req.systemPrompt ? { role: "system", content: req.systemPrompt } : null,
        { role: "user", content: req.userPrompt },
      ].filter(Boolean),
    };

    try {
      const res = await fetch(DEEPSEEK_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errText = await res.text();
        return { text: `DeepSeek error: ${res.status} ${errText}`, tokensUsed: 0 };
      }

      const json: any = await res.json();
      const text = json.choices?.[0]?.message?.content ?? "";
      return {
        text,
        tokensUsed: json.usage?.total_tokens ?? 0,
        raw: json,
      };
    } catch (err: any) {
      return { text: `DeepSeek fetch error: ${err?.message || String(err)}`, tokensUsed: 0 };
    }
  },
};