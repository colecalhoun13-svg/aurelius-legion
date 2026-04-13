/**
 * autonomousResearch.ts
 * Aurelius OS v3.4 — Autonomous Research Engine
 *
 * This module performs:
 *  - multi‑engine research queries
 *  - synthesis across DeepSeek, Gemini, and xAI
 *  - structured output for corpus updates
 */

import { deepseekChat } from "../engines/deepseekClient.ts";
import { xaiChat } from "../engines/xaiClient.ts";
import { GoogleGenerativeAI } from "@google/generative-ai";

const gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

/**
 * MASTER RESEARCH PROMPT
 * This is the Aurelius 3.4 research blueprint.
 */
const RESEARCH_PROMPT = `
You are Aurelius — a multi‑engine research intelligence system.

Your task:
1. Analyze the topic deeply.
2. Pull out:
   - key principles
   - actionable insights
   - contradictions
   - emerging trends
   - practical applications
3. Produce structured JSON:
{
  "summary": "",
  "principles": [],
  "insights": [],
  "contradictions": [],
  "applications": []
}

Rules:
- Be concise but intelligent.
- No fluff.
- No generic advice.
- No motivational language.
- Only evidence‑based reasoning.
`;

/**
 * Run Gemini research (broad, factual, high‑context)
 */
async function runGeminiResearch(topic: string): Promise<string> {
  try {
    const model = gemini.getGenerativeModel({ model: "gemini-pro" });
    const result = await model.generateContent(
      `${RESEARCH_PROMPT}\n\nTOPIC: ${topic}`
    );
    return result.response.text();
  } catch (err) {
    console.error("Gemini research error:", err);
    return "Gemini research failed.";
  }
}

/**
 * Run DeepSeek research (strategic, analytical, high‑reasoning)
 */
async function runDeepSeekResearch(topic: string): Promise<string> {
  return await deepseekChat(
    RESEARCH_PROMPT,
    `TOPIC: ${topic}`
  );
}

/**
 * Run xAI research (creative synthesis, alternative angles)
 */
async function runXaiResearch(topic: string): Promise<string> {
  return await xaiChat(
    RESEARCH_PROMPT,
    `TOPIC: ${topic}`
  );
}

/**
 * MASTER RESEARCH FUNCTION
 * Combines:
 *  - Gemini (breadth)
 *  - DeepSeek (depth)
 *  - xAI (synthesis)
 */
export async function autonomousResearch(topic: string) {
  console.log(`Running autonomous research on: ${topic}`);

  const [geminiOut, deepseekOut, xaiOut] = await Promise.all([
    runGeminiResearch(topic),
    runDeepSeekResearch(topic),
    runXaiResearch(topic)
  ]);

  /**
   * Final synthesis prompt
   * This merges all three engines into one unified intelligence output.
   */
  const synthesisPrompt = `
You are Aurelius — merge the following research outputs into one unified JSON object.

GEMINI:
${geminiOut}

DEEPSEEK:
${deepseekOut}

XAI:
${xaiOut}

Rules:
- Identify overlaps.
- Identify contradictions.
- Extract the strongest principles.
- Produce clean JSON only.
`;

  const final = await deepseekChat(
    "You are Aurelius — master research synthesizer.",
    synthesisPrompt
  );

  return final;
}
