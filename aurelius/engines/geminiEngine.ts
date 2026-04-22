// aurelius/engines/geminiEngine.ts

import {
  EngineAdapter,
  EngineRequest,
  EngineResponse,
} from "./engineAdapter";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";

export const geminiAdapter: EngineAdapter = {
  name: "gemini",

  async run(req: EngineRequest): Promise<EngineResponse> {
    if (!GEMINI_API_KEY) {
      return {
        text: "GEMINI_API_KEY is not configured.",
        tokensUsed: 0,
      };
    }

    const system = req.systemPrompt ? `${req.systemPrompt}\n\n` : "";
    const prompt = `${system}${req.userPrompt}`;

    const res = await fetch(
      `${GEMINI_ENDPOINT}?key=${encodeURIComponent(GEMINI_API_KEY)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }],
            },
          ],
        }),
      }
    );

    if (!res.ok) {
      const text = await res.text();
      return {
        text: `Gemini error: ${res.status} ${text}`,
        tokensUsed: 0,
      };
    }

    const json: any = await res.json();
    const text =
      json.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    return {
      text,
      tokensUsed: 0,
      raw: json,
    };
  },
};
