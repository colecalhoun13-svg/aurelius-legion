// aurelius/engines/xaiClient.ts

import axios from "axios";
import {
  EngineAdapter,
  EngineRequest,
  EngineResponse,
} from "./engineAdapter";

const XAI_API_KEY = process.env.XAI_API_KEY || "";
const XAI_ENDPOINT =
  "https://api.x.ai/v1/chat/completions";

export const xaiAdapter: EngineAdapter = {
  name: "xai",

  async run(req: EngineRequest): Promise<EngineResponse> {
    if (!XAI_API_KEY) {
      return {
        text: "XAI_API_KEY is not configured.",
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
        XAI_ENDPOINT,
        {
          model: req.model || "grok-beta",
          messages,
        },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${XAI_API_KEY}`,
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
        text: `xAI/Grok error: ${err?.message ?? "Unknown error"}`,
        tokensUsed: 0,
      };
    }
  },
};
