/**
 * engineRouter.ts
 * Aurelius OS v3.4 — Multi-Engine Intelligence Router (Safe Lazy Init)
 *
 * TEMPORARY MODE: Force Groq for all messages until UI loop is verified.
 */

import type { OperatorType } from "../types.ts";

// Lazy SDK imports (clients created inside functions)
import OpenAI from "openai";
import Groq from "groq-sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";

// HTTP clients
import { deepseekChat } from "../engines/deepseekClient.ts";
import { xaiChat } from "../engines/xaiClient.ts";

// Anthropic (Claude 3.5 Sonnet)
import { runAnthropic } from "../engines/anthropicEngine.ts";

// ---------------------------------------------------------
// ENGINE TYPE UNION
// ---------------------------------------------------------
export type EngineName =
  | "groq"
  | "anthropic"
  | "openai"
  | "gemini"
  | "deepseek"
  | "xai";

// ---------------------------------------------------------
// TEMPORARY OVERRIDE — FORCE GROQ FOR TESTING
// ---------------------------------------------------------
export function selectEngine(operator: OperatorType): EngineName {
  return "groq"; // Use Groq for free, stable testing
}

// ---------------------------------------------------------
// ENGINE ROUTER (LAZY CLIENT INITIALIZATION)
// ---------------------------------------------------------
export async function engineRouter(
  operator: OperatorType,
  systemPrompt: string,
  userMessage: string
): Promise<string> {
  const engine = selectEngine(operator);

  try {
    switch (engine) {
      // -----------------------------
      // GROQ — Lazy Init (TEMPORARY PRIMARY ENGINE)
      // -----------------------------
      case "groq": {
        const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

        const completion = await groq.chat.completions.create({
          model: "llama-3.3-70b-versatile", // UPDATED MODEL
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessage }
          ]
        });

        return completion.choices[0].message?.content || "";
      }

      // -----------------------------
      // OPENAI — Lazy Init
      // -----------------------------
      case "openai": {
        const openai = new OpenAI({
          apiKey: process.env.OPENAI_API_KEY
        });

        const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessage }
          ]
        });

        return completion.choices[0].message?.content || "";
      }

      // -----------------------------
      // GEMINI — Lazy Init
      // -----------------------------
      case "gemini": {
        const gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
        const model = gemini.getGenerativeModel({ model: "gemini-pro" });

        const result = await model.generateContent(
          `${systemPrompt}\nUser: ${userMessage}`
        );

        return result.response.text();
      }

      // -----------------------------
      // ANTHROPIC (Claude)
      // -----------------------------
      case "anthropic": {
        return await runAnthropic({
          message: userMessage,
          systemPrompt,
          maxTokens: 4096
        });
      }

      // -----------------------------
      // DEEPSEEK
      // -----------------------------
      case "deepseek":
        return await deepseekChat(systemPrompt, userMessage);

      // -----------------------------
      // XAI (Grok)
      // -----------------------------
      case "xai":
        return await xaiChat(systemPrompt, userMessage);

      default:
        return "Engine selection failed.";
    }
  } catch (err) {
    console.error("Engine Router Error:", err);
    return "Aurelius encountered an engine routing error.";
  }
}
