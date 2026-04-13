// aurelius/engines/deepseekClient.ts

import axios from "axios";

/**
 * DeepSeek chat client
 * Uses OpenAI-compatible chat completions endpoint.
 */
export async function deepseekChat(
  systemPrompt: string,
  userMessage: string
): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY;

  if (!apiKey) {
    console.error("DeepSeek API key missing (DEEPSEEK_API_KEY).");
    return "DeepSeek engine is not configured. Missing API key.";
  }

  try {
    const response = await axios.post(
      "https://api.deepseek.com/v1/chat/completions",
      {
        model: "deepseek-chat",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage }
        ]
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`
        }
      }
    );

    // Defensive return — DeepSeek sometimes returns null message blocks
    return (
      response?.data?.choices?.[0]?.message?.content?.trim() ??
      "DeepSeek returned no content."
    );
  } catch (error: any) {
    console.error("DeepSeek client error:", error?.message || error);
    return "DeepSeek engine encountered an error while processing the request.";
  }
}

