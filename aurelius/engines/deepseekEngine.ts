// aurelius/engines/deepseekEngine.ts
import type { EngineAdapter, EngineRequest, EngineResponse } from "./engineAdapter.ts";
import { REQUEST_TIMEOUT_MS } from "./engineAdapter.ts";

const DEEPSEEK_ENDPOINT = "https://api.deepseek.com/chat/completions";

export const deepseekAdapter: EngineAdapter = {
  name: "deepseek",
  async run(req: EngineRequest): Promise<EngineResponse> {
    const apiKey = (process.env.DEEPSEEK_API_KEY || "").trim().replace(/^["']|["']$/g, "");
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
        // TIMEOUT — see anthropicEngine. DeepSeek-reasoner is the slowest of the
        // six, so it gets the same generous ceiling rather than a shorter one.
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      if (!res.ok) {
        const errText = await res.text();
        return { text: `DeepSeek error: ${res.status} ${errText}`, tokensUsed: 0 };
      }

      const json: any = await res.json();
      const text = json.choices?.[0]?.message?.content ?? "";
      if (!text) console.warn("[DEEPSEEK] empty text — finish_reason:", json.choices?.[0]?.finish_reason);
      return {
        text,
        tokensUsed: json.usage?.total_tokens ?? 0,
        tokensIn: json.usage?.prompt_tokens ?? 0,
        tokensOut: json.usage?.completion_tokens ?? 0,
        tokensCachedIn: (json.usage as any)?.prompt_tokens_details?.cached_tokens ?? 0,
        raw: json,
      };
    } catch (err: any) {
      return { text: `DeepSeek fetch error: ${err?.message || String(err)}`, tokensUsed: 0 };
    }
  },
};