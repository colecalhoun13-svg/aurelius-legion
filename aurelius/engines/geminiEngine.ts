// aurelius/engines/geminiEngine.ts
import type { EngineAdapter, EngineRequest, EngineResponse } from "./engineAdapter.ts";

export const geminiAdapter: EngineAdapter = {
  name: "gemini",
  async run(req: EngineRequest): Promise<EngineResponse> {
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
    if (!GEMINI_API_KEY) {
      return { text: "GEMINI_API_KEY is not configured.", tokensUsed: 0 };
    }

    const model = req.model || "gemini-2.5-pro";
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

    const body: any = {
      contents: [
        {
          role: "user",
          parts: [{ text: req.userPrompt }],
        },
      ],
    };

    if (req.systemPrompt) {
      body.systemInstruction = {
        parts: [{ text: req.systemPrompt }],
      };
    }

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errText = await res.text();
        return { text: `Gemini error: ${res.status} ${errText}`, tokensUsed: 0 };
      }

      const json: any = await res.json();
      const text = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
      const tokensUsed =
        (json?.usageMetadata?.promptTokenCount || 0) +
        (json?.usageMetadata?.candidatesTokenCount || 0);

      return { text, tokensUsed, raw: json };
    } catch (err: any) {
      return { text: `Gemini fetch error: ${err?.message || String(err)}`, tokensUsed: 0 };
    }
  },
};