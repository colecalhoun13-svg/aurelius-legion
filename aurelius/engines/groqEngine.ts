// aurelius/engines/groqEngine.ts
import type { EngineAdapter, EngineRequest, EngineResponse } from "./engineAdapter.ts";
import { REQUEST_TIMEOUT_MS } from "./engineAdapter.ts";

const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";

// Groq retires model IDs aggressively, and this tier carries the cheap
// high-volume work (log/extract/track/quick_reply/summary/rewrite). A dead ID
// 404s every one of them into failover — honest, but only visible in chat.
// Rotate candidates on 404 and cache the winner, same self-heal as gemini.
const MODEL_CANDIDATES = [
  process.env.GROQ_CHAT_MODEL?.trim(),
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant",
].filter((m): m is string => !!m);
let cachedModel: string | null = null;

export const groqAdapter: EngineAdapter = {
  name: "groq",
  async run(req: EngineRequest): Promise<EngineResponse> {
    const GROQ_API_KEY = (process.env.GROQ_API_KEY || "").trim().replace(/^["']|["']$/g, "");
    if (!GROQ_API_KEY) {
      return { text: "GROQ_API_KEY is not configured.", tokensUsed: 0 };
    }

    const messages = [
      req.systemPrompt ? { role: "system", content: req.systemPrompt } : null,
      { role: "user", content: req.userPrompt },
    ].filter(Boolean);

    try {
      // The router's choice goes first, then the fallbacks — but once a model
      // has answered, stick to it rather than re-probing every call.
      const candidates = cachedModel
        ? [cachedModel]
        : [req.model, ...MODEL_CANDIDATES].filter((m): m is string => !!m);
      let res: Response | null = null;
      let lastErr = "no models tried";
      for (const model of candidates) {
        const attempt = await fetch(GROQ_ENDPOINT, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${GROQ_API_KEY}`,
          },
          body: JSON.stringify({ model, messages }),
          // TIMEOUT — see anthropicEngine: no signal meant a stalled socket hung
          // the whole router with no failover and no log line.
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
        if (attempt.status === 404 || attempt.status === 400) {
          // Groq returns 400 "model_decommissioned" as often as a 404.
          const body = await attempt.text();
          if (/decommission|not found|does not exist|model_not_found/i.test(body)) {
            lastErr = `model ${model} unavailable (${attempt.status})`;
            if (cachedModel === model) cachedModel = null;
            continue;
          }
          return { text: `Groq error: ${attempt.status} ${body}`, tokensUsed: 0 };
        }
        cachedModel = model;
        res = attempt;
        break;
      }
      if (!res) return { text: `Groq error: ${lastErr}`, tokensUsed: 0 };

      if (!res.ok) {
        const errText = await res.text();
        return { text: `Groq error: ${res.status} ${errText}`, tokensUsed: 0 };
      }

      const json: any = await res.json();
      const text = json.choices?.[0]?.message?.content ?? "";
      if (!text) console.warn("[GROQ] empty text — finish_reason:", json.choices?.[0]?.finish_reason);
      return {
        text,
        tokensUsed: json.usage?.total_tokens ?? 0,
        tokensIn: json.usage?.prompt_tokens ?? 0,
        tokensOut: json.usage?.completion_tokens ?? 0,
        tokensCachedIn: (json.usage as any)?.prompt_tokens_details?.cached_tokens ?? 0,
        raw: json,
      };
    } catch (err: any) {
      return { text: `Groq fetch error: ${err?.message || String(err)}`, tokensUsed: 0 };
    }
  },
};