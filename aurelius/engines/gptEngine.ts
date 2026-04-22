// aurelius/engines/gptEngine.ts

import OpenAI from "openai";
import {
  EngineAdapter,
  EngineRequest,
  EngineResponse,
} from "./engineAdapter";

const apiKey = process.env.OPENAI_API_KEY || "";
const client = apiKey ? new OpenAI({ apiKey }) : null;

export const gptAdapter: EngineAdapter = {
  name: "gpt",

  async run(req: EngineRequest): Promise<EngineResponse> {
    if (!client) {
      return {
        text: "OpenAI API key is not configured.",
        tokensUsed: 0,
      };
    }

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

    if (req.systemPrompt) {
      messages.push({ role: "system", content: req.systemPrompt });
    }

    messages.push({ role: "user", content: req.userPrompt });

    const completion = await client.chat.completions.create({
      model: req.model || "gpt-4o-mini",
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
  },
};
