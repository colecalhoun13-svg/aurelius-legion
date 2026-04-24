// aurelius/engines/groqEngine.ts
import type { EngineAdapter, EngineRequest, EngineResponse } from "./engineAdapter.ts";

const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";

export const groqAdapter: EngineAdapter = {
  name: "groq",
  async run(req: EngineRequest): Promise<EngineResponse> {
    const GROQ_API_KEY = process.env.GROQ_API_KEY || "";
    if (!GROQ_API_KEY) {
      return { text: "GROQ_API_KEY is not configured.", tokensUsed: 0 };
    }

    const body = {
      model: req.model || "llama-3.3-70b-versatile",
      messages: [
        req.systemPrompt ? { role: "system", content: req.systemPrompt } : null,
        { role: "user", content: req.userPrompt },
      ].filter(Boolean),
    };

    try {
      const res = await fetch(GROQ_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${GROQ_API_KEY}`,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errText = await res.text();
        return { text: `Groq error: ${res.status} ${errText}`, tokensUsed: 0 };
      }

      const json: any = await res.json();
      const text = json.choices?.[0]?.message?.content ?? "";
      return {
        text,
        tokensUsed: json.usage?.total_tokens ?? 0,
        raw: json,
      };
    } catch (err: any) {
      return { text: `Groq fetch error: ${err?.message || String(err)}`, tokensUsed: 0 };
    }
  },
};