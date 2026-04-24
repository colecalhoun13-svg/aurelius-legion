// aurelius/engines/gptEngine.ts
import OpenAI from "openai";
import type { EngineAdapter, EngineRequest, EngineResponse } from "./engineAdapter.ts";

export const gptAdapter: EngineAdapter = {
  name: "gpt",
  async run(req: EngineRequest): Promise<EngineResponse> {
    const apiKey = process.env.OPENAI_API_KEY || "";
    if (!apiKey) {
      return { text: "OPENAI_API_KEY is not configured.", tokensUsed: 0 };
    }

    const client = new OpenAI({ apiKey });

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
    if (req.systemPrompt) {
      messages.push({ role: "system", content: req.systemPrompt });
    }
    messages.push({ role: "user", content: req.userPrompt });

    try {
      const completion = await client.chat.completions.create({
        model: req.model || "gpt-5.4-mini",
        messages,
      });

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