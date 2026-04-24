// aurelius/engines/xaiClient.ts
import type { EngineAdapter, EngineRequest, EngineResponse } from "./engineAdapter.ts";

const XAI_ENDPOINT = "https://api.x.ai/v1/chat/completions";

export const xaiAdapter: EngineAdapter = {
  name: "xai",
  async run(req: EngineRequest): Promise<EngineResponse> {
    const XAI_API_KEY = process.env.XAI_API_KEY || "";
    if (!XAI_API_KEY) {
      return { text: "XAI_API_KEY is not configured.", tokensUsed: 0 };
    }

    const body = {
      model: req.model || "grok-4-1-fast-reasoning",
      messages: [
        req.systemPrompt ? { role: "system", content: req.systemPrompt } : null,
        { role: "user", content: req.userPrompt },
      ].filter(Boolean),
    };

    try {
      const res = await fetch(XAI_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${XAI_API_KEY}`,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errText = await res.text();
        return { text: `xAI error: ${res.status} ${errText}`, tokensUsed: 0 };
      }

      const json: any = await res.json();
      const text = json.choices?.[0]?.message?.content ?? "";
      return {
        text,
        tokensUsed: json.usage?.total_tokens ?? 0,
        raw: json,
      };
    } catch (err: any) {
      return { text: `xAI fetch error: ${err?.message || String(err)}`, tokensUsed: 0 };
    }
  },
};