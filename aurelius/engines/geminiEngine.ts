// aurelius/engines/geminiEngine.ts
import type { EngineAdapter, EngineRequest, EngineResponse } from "./engineAdapter.ts";

// Google deprecates/renames model IDs; a hardcoded one 404s the day it's retired
// and the multimodal tier silently collapses to a text-only failover. Rotate a
// candidate list on 404 and cache the winner — same self-heal as vision.ts /
// webSearch.ts. The req.model (router's choice) always goes first.
const MODEL_CANDIDATES = [
  process.env.GEMINI_CHAT_MODEL?.trim(),
  "gemini-2.5-pro",
  "gemini-2.0-flash",
  "gemini-flash-latest",
  "gemini-2.5-flash",
].filter((m): m is string => !!m);
let cachedModel: string | null = null;

export const geminiAdapter: EngineAdapter = {
  name: "gemini",
  async run(req: EngineRequest): Promise<EngineResponse> {
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
    if (!GEMINI_API_KEY) {
      return { text: "GEMINI_API_KEY is not configured.", tokensUsed: 0 };
    }

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
    if (req.tools?.length) body.tools = req.tools;

    // Try: the requested model, then cached winner, then the rest — skipping a
    // model that just 404'd. First non-404 response wins and is cached.
    const candidates = [req.model, cachedModel, ...MODEL_CANDIDATES].filter(
      (m, i, arr): m is string => !!m && arr.indexOf(m) === i
    );

    try {
      let res: Response | null = null;
      let lastStatus = 0;
      let lastErrText = "";
      for (const model of candidates) {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
        const attempt = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (attempt.status === 404) {
          lastStatus = 404;
          lastErrText = `model ${model} unavailable (404)`;
          if (cachedModel === model) cachedModel = null;
          continue;
        }
        cachedModel = model; // remember the one that answered (even an error that isn't 404)
        res = attempt;
        break;
      }

      if (!res) {
        return { text: `Gemini error: ${lastStatus} ${lastErrText}`, tokensUsed: 0 };
      }

      if (!res.ok) {
        const errText = await res.text();
        return { text: `Gemini error: ${res.status} ${errText}`, tokensUsed: 0 };
      }

      const json: any = await res.json();
      // Gemini returns candidates[0].content.parts[] — concatenate every text
      // part, not just parts[0] (which can be a non-text part and drop the reply).
      const cand = json?.candidates?.[0];
      let text = "";
      if (Array.isArray(cand?.content?.parts)) {
        text = cand.content.parts
          .filter((p: any) => typeof p?.text === "string")
          .map((p: any) => p.text)
          .join("")
          .trim();
      }
      const hasFunctionCall =
        Array.isArray(cand?.content?.parts) && cand.content.parts.some((p: any) => p?.functionCall);
      if (!text && !hasFunctionCall) {
        console.warn(
          "[GEMINI] empty text extracted — finishReason:",
          cand?.finishReason,
          "· blockReason:",
          json?.promptFeedback?.blockReason
        );
      }
      const tokensUsed =
        (json?.usageMetadata?.promptTokenCount || 0) +
        (json?.usageMetadata?.candidatesTokenCount || 0);

      return { text, tokensUsed, raw: json };
    } catch (err: any) {
      return { text: `Gemini fetch error: ${err?.message || String(err)}`, tokensUsed: 0 };
    }
  },
};