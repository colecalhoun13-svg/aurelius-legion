// aurelius/engines/deepseekClient.ts

import axios from "axios";
import {
  EngineAdapter,
  EngineRequest,
  EngineResponse,
} from "./engineAdapter.ts";

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || "";
const DEEPSEEK_ENDPOINT =
  "https://api.deepseek.com/chat/completions";

export const deepseekAdapter: EngineAdapter = {
  name: "deepseek",

  async run(req: EngineRequest): Promise<EngineResponse> {
    if (!DEEPSEEK_API_KEY) {
      return {
        text: "DEEPSEEK_API_KEY is not configured.",
        tokensUsed: 0,
      };
    }

    try {
      const messages: any[] = [];

      if (req.systemPrompt) {
        messages.push({
          role: "system",
          content: req.systemPrompt,
        });
      }

      messages.push({
        role: "user",
        content: req.userPrompt,
      });

      const response = await axios.post(
        DEEPSEEK_ENDPOINT,
        {
          model: req.model || "deepseek-chat",
          messages,
        },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
          },
        }
      );

      const data = response.data;
      const choice = data.choices?.[0];
      const text = choice?.message?.content ?? "";

      return {
        text,
        tokensUsed: data.usage?.total_tokens ?? 0,
        raw: data,
      };
    } catch (err: any) {
      return {
        text: `DeepSeek error: ${err?.message ?? "Unknown error"}`,
        tokensUsed: 0,
      };
    }
  },
};
