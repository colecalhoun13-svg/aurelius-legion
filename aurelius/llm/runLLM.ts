/**
 * Aurelius OS v3.4 — runLLM()
 * Unified entrypoint for all LLM calls.
 * Routes through the Hybrid LLM Router and logs usage.
 */

import { routeLLM } from "./router.ts";

export type RunLLMInput = {
  taskType: string;        // "cue", "research", "reflection", "plan", etc.
  operator?: string;       // "strategy", "athlete", "business", etc.
  autonomyMode?: string;   // "reactive", "planning", "reflection"
  urgency?: "low" | "medium" | "high";
  input: string;
};

export async function runLLM(params: RunLLMInput): Promise<string> {
  const start = Date.now();

  const output = await routeLLM({
    taskType: params.taskType,
    operator: params.operator,
    autonomyMode: params.autonomyMode,
    urgency: params.urgency,
    input: params.input
  });

  const latency = Date.now() - start;

  // Cockpit logging event
  console.log("[AURELIUS][LLM]", {
    taskType: params.taskType,
    operator: params.operator,
    autonomyMode: params.autonomyMode,
    urgency: params.urgency,
    latencyMs: latency,
    timestamp: new Date().toISOString()
  });

  return output;
}
