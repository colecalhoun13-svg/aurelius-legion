// aurelius/engines/gptEngine.ts
import OpenAI from "openai";
import type { EngineAdapter, EngineRequest, EngineResponse } from "./engineAdapter.ts";

// SELF-HEAL ON A RETIRED MODEL ID, same pattern as gemini and groq.
// The frontier fallback (`gpt-5.4`) and the structured tier (`gpt-5.4-mini`)
// are model IDs this codebase asserts but has never verified against a live
// account — and I shipped the frontier one as a fallback target while saying
// out loud that I couldn't check it. A hardcoded ID that 404s takes a whole
// tier down silently. Rotate to the next candidate instead, cache the winner,
// and let the doctor confirm what the account can actually reach.
const MODEL_FALLBACKS: Record<string, string[]> = {
  "gpt-5.4": ["gpt-5.4", "gpt-5.4-mini", "gpt-4.1"],
  "gpt-5.4-mini": ["gpt-5.4-mini", "gpt-4.1-mini", "gpt-4.1"],
};
const cachedModel = new Map<string, string>();

function isMissingModel(err: any): boolean {
  const status = err?.status ?? err?.response?.status;
  const msg = String(err?.message ?? err?.error?.message ?? "");
  return status === 404 || /model.*(not found|does not exist|unavailable)|invalid.*model/i.test(msg);
}

export const gptAdapter: EngineAdapter = {
  name: "gpt",
  async run(req: EngineRequest): Promise<EngineResponse> {
    const apiKey = (process.env.OPENAI_API_KEY || "").trim().replace(/^["']|["']$/g, "");
    if (!apiKey) {
      return { text: "OPENAI_API_KEY is not configured.", tokensUsed: 0 };
    }

    const client = new OpenAI({ apiKey });

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
    if (req.systemPrompt) {
      messages.push({ role: "system", content: req.systemPrompt });
    }
    messages.push({ role: "user", content: req.userPrompt });

    const requested = req.model || "gpt-5.4-mini";
    const candidates = cachedModel.has(requested)
      ? [cachedModel.get(requested)!]
      : (MODEL_FALLBACKS[requested] ?? [requested]);

    try {
      let completion: any = null;
      let lastMissing = "";
      for (const model of candidates) {
        try {
          completion = await client.chat.completions.create({
            model,
            messages,
            ...(req.tools?.length ? { tools: req.tools as any } : {}),
          });
          if (model !== requested) {
            console.warn(`[OPENAI] "${requested}" unavailable — using "${model}" instead`);
          }
          cachedModel.set(requested, model);
          break;
        } catch (err: any) {
          if (!isMissingModel(err)) throw err; // a real error, not a dead ID
          lastMissing = `${model} unavailable`;
          cachedModel.delete(requested);
        }
      }
      if (!completion) {
        return { text: `OpenAI error: no available model (tried ${candidates.join(", ")}; ${lastMissing})`, tokensUsed: 0 };
      }

      const choice = completion.choices[0];
      const content: any = choice?.message?.content;

      let text = "";
      if (typeof content === "string") {
        text = content;
      } else if (Array.isArray(content)) {
        text = content
          .map((part: any) => {
            if (typeof part === "string") return part;
            if (typeof part?.text === "string") return part.text;
            return "";
          })
          .join("\n")
          .trim();
      } else if (content != null) {
        text = String(content);
      }

      return {
        text,
        tokensUsed: completion.usage?.total_tokens ?? 0,
        tokensIn: completion.usage?.prompt_tokens ?? 0,
        tokensOut: completion.usage?.completion_tokens ?? 0,
        tokensCachedIn: (completion.usage as any)?.prompt_tokens_details?.cached_tokens ?? 0,
        raw: completion,
      };
    } catch (err: any) {
      return {
        text: `OpenAI error: ${err?.message || String(err)}`,
        tokensUsed: 0,
      };
    }
  },
};