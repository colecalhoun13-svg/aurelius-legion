// aurelius/core/engineRouter.ts
/**
 * Aurelius OS v3.4 — Multi‑Engine Routing Core
 * ---------------------------------------------------------
 * This is the upgraded, Jarvis‑class engine router.
 * - Multi‑engine routing (OpenAI, Groq, Gemini, DeepSeek, xAI)
 * - Persona injection
 * - Operator overlays
 * - Operator core injection
 * - Fallback logic
 * - Operator + Engine analytics tracking (NEW)
 */

import type { OperatorType } from "../types.ts";
import { BASE_PERSONA_PROMPT, OPERATOR_PERSONAS } from "../persona/aureliusPersona.ts";

import { loadCore } from "../operators/coreLoader.ts";
import type { OperatorCore } from "../operators/coreTypes.ts";

// === NEW: Analytics tracking ===
import { trackOperatorUsage, trackEngineUsage } from "../analytics/usageTracker.ts";

// Engine clients
import OpenAI from "openai";
import Groq from "groq-sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";

import { deepseekChat } from "../engines/deepseekClient.ts";
import { xaiChat } from "../engines/xaiClient.ts";

// Instantiate clients
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || ""
});

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY || ""
});

const gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

/**
 * Summarize operator core for injection into system prompt
 */
function summarizeCore(core: OperatorCore | null): string {
  if (!core) return "";

  const principles = core.principles.slice(0, 5).join("\n- ");
  const constraints = core.constraints.slice(0, 5).join("\n- ");

  return `
Operator Core Snapshot (v${core.version}):

Key principles:
- ${principles}

Key constraints:
- ${constraints}
`.trim();
}

/**
 * Build final system prompt:
 * - Global persona
 * - Operator overlay
 * - Operator core summary
 * - Local system prompt
 */
function buildSystemPrompt(operator: OperatorType, systemPrompt: string): string {
  const operatorOverlay = OPERATOR_PERSONAS[operator] || "";
  const core = loadCore(operator);
  const coreSummary = summarizeCore(core);

  return `
${BASE_PERSONA_PROMPT}

${operatorOverlay}

${coreSummary ? coreSummary + "\n\n" : ""}Additional system context:
${systemPrompt}
`.trim();
}

/**
 * Engine selection logic
 */
function chooseEngine(operator: OperatorType):
  | "openai"
  | "groq"
  | "gemini"
  | "deepseek"
  | "xai" {
  switch (operator) {
    case "strategy":
    case "business":
    case "wealth":
    case "finance":
      return "groq";

    case "research":
      return "gemini";

    case "athlete":
    case "training":
      return "deepseek";

    case "content":
      return "xai";

    default:
      return "openai";
  }
}

/**
 * Engine wrappers
 */
async function callOpenAI(systemPrompt: string, message: string): Promise<string> {
  const completion = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: message }
    ]
  });

  return completion.choices[0]?.message?.content || "";
}

async function callGroq(systemPrompt: string, message: string): Promise<string> {
  const completion = await groq.chat.completions.create({
    model: "llama-3.1-70b-versatile",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: message }
    ]
  });

  return completion.choices[0]?.message?.content || "";
}

async function callGemini(systemPrompt: string, message: string): Promise<string> {
  const model = gemini.getGenerativeModel({ model: "gemini-pro" });

  const result = await model.generateContent([
    {
      role: "user",
      parts: [
        {
          text: `${systemPrompt}\n\nUSER:\n${message}`
        }
      ]
    }
  ]);

  return result.response.text();
}

async function callDeepSeek(systemPrompt: string, message: string): Promise<string> {
  return await deepseekChat(systemPrompt, message);
}

async function callXai(systemPrompt: string, message: string): Promise<string> {
  return await xaiChat(systemPrompt, message);
}

/**
 * MAIN ENGINE ROUTER
 */
export async function engineRouter(
  operator: OperatorType,
  systemPrompt: string,
  message: string
): Promise<string> {
  const finalSystemPrompt = buildSystemPrompt(operator, systemPrompt);
  const engine = chooseEngine(operator);

  // === NEW: analytics tracking ===
  trackOperatorUsage(operator);
  trackEngineUsage(engine);

  try {
    switch (engine) {
      case "groq":
        return await callGroq(finalSystemPrompt, message);

      case "gemini":
        return await callGemini(finalSystemPrompt, message);

      case "deepseek":
        return await callDeepSeek(finalSystemPrompt, message);

      case "xai":
        return await callXai(finalSystemPrompt, message);

      case "openai":
      default:
        return await callOpenAI(finalSystemPrompt, message);
    }
  } catch (err) {
    console.error("engineRouter error, falling back to OpenAI:", err);
    return await callOpenAI(finalSystemPrompt, message);
  }
}
