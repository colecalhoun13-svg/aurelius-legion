/**
 * xaiClient.ts
 * Aurelius OS v3.4 — Grok (xAI) Engine
 *
 * Correct payload format for xAI Chat Completions API.
 */

import axios from "axios";

export async function xaiChat(systemPrompt: string, userMessage: string) {
  try {
    const apiKey = process.env.XAI_API_KEY;

    const response = await axios.post(
      "https://api.x.ai/v1/chat/completions",
      {
        model: "grok-3",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage }
        ],
        stream: false
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`
        }
      }
    );

    return (
      response.data?.choices?.[0]?.message?.content ||
      "Grok returned no content."
    );
  } catch (err: any) {
    console.error("Grok (xAI) Error:", err.response?.data || err.message);
    return "Grok engine encountered an error.";
  }
}
