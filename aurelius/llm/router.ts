/**
 * Aurelius OS v3.4 — Hybrid LLM Router
 * Economical, context-aware, operator-aware, autonomy-aware.
 */

import { gptAdapter } from "../engines/gptEngine.ts";
import { groqAdapter } from "../engines/groqEngine.ts";
import { anthropicAdapter } from "../engines/anthropicEngine.ts";
import { geminiAdapter } from "../engines/geminiEngine.ts";
import { xaiAdapter } from "../engines/xaiClient.ts";
import { deepseekAdapter } from "../engines/deepseekEngine.ts";
import { getOperatorProfile } from "../core/operatorProfiles.ts";

export type LLMTask = {
  taskType: string;        // "cue", "research", "reflection", "plan", etc.
  operator?: string;       // "strategy", "athlete", "business", etc.
  autonomyMode?: string;   // "reactive", "planning", "reflection"
  urgency?: "low" | "medium" | "high";
  input: string;
};

export type LLMChoice = {
  provider: string;
  model: string;
  reason: string;
};

function scoreComplexity(taskType: string): number {
  switch (taskType) {
    case "cue":
    case "summary":
    case "rewrite":
      return 1;
    case "analysis":
    case "insight":
      return 2;
    case "plan":
    case "reflection":
      return 3;
    case "research":
    case "synthesis":
      return 4;
    default:
      return 2;
  }
}

function scoreAutonomy(mode?: string): number {
  switch (mode) {
    case "reactive":
      return 1;
    case "planning":
      return 3;
    case "reflection":
      return 4;
    default:
      return 2;
  }
}

function scoreUrgency(urgency?: string): number {
  switch (urgency) {
    case "high":
      return 1; // speed > depth
    case "medium":
      return 2;
    case "low":
      return 3; // depth > speed
    default:
      return 2;
  }
}

export function chooseModel(task: LLMTask): LLMChoice {
  const complexity = scoreComplexity(task.taskType);
  const autonomy = scoreAutonomy(task.autonomyMode);
  const urgencyScore = scoreUrgency(task.urgency);

  const profile = task.operator ? getOperatorProfile(task.operator) : undefined;
  const decision = profile?.decisionProfile;
  const routing = profile?.routingHints;

  // Base depth from task + autonomy
  let depthScore = complexity + autonomy;

  // Operator depth bias
  if (decision?.depthBias === "deep") depthScore += 2;
  else if (decision?.depthBias === "medium") depthScore += 1;

  // Speed bias (operator preference)
  let speedScore = urgencyScore;
  if (decision?.speedBias === "fast") speedScore -= 1;
  if (decision?.speedBias === "slow") speedScore += 1;

  // Correctness is always strict by your spec, but we still read it
  const correctnessPriority = decision?.correctnessPriority ?? "strict";
  const allowDegradation =
    routing?.allowDegradationUnderUrgency === true &&
    task.urgency === "high" &&
    correctnessPriority !== "strict";

  // ⭐ Urgent AND allowed to degrade → fast path
  if (speedScore <= 1 && allowDegradation) {
    return {
      provider: "groq",
      model: "llama-3.1-70b",
      reason:
        "High urgency with allowed degradation → fastest model (Groq) while preserving acceptable correctness."
    };
  }

  // ⭐ If low complexity AND correctness not strict → economical
  if (depthScore <= 3 && correctnessPriority !== "strict") {
    return {
      provider: "deepseek",
      model: "deepseek-r1-distill",
      reason: "Low effective depth and non-strict correctness → economical reasoning."
    };
  }

  // Preferred tier hint
  const preferredTier = routing?.preferredModelTier ?? "balanced";

  // ⭐ High depth → premium / deep models
  if (depthScore >= 7 || preferredTier === "premium") {
    return {
      provider: "anthropic",
      model: "claude-3.7-sonnet",
      reason:
        "High depth and strict correctness → premium deep reasoning (Anthropic Sonnet)."
    };
  }

  // ⭐ Medium depth → balanced models
  if (depthScore > 3 && depthScore < 7) {
    return {
      provider: "openai",
      model: "o3-mini",
      reason: "Medium depth → balanced cost/performance (OpenAI o3-mini)."
    };
  }

  // ⭐ Fallback → economical but still capable
  return {
    provider: "deepseek",
    model: "deepseek-r1-distill",
    reason: "Fallback to economical model with reasonable reasoning depth."
  };
}

export async function routeLLM(task: LLMTask): Promise<string> {
  const choice = chooseModel(task);
  const profile = task.operator ? getOperatorProfile(task.operator) : undefined;

  const systemPrompt = `
You are Aurelius OS v3.4 — hybrid, economical, operator-aware, identity-layer aware.
Task Type: ${task.taskType}
Operator: ${task.operator}
Autonomy Mode: ${task.autonomyMode}
Urgency: ${task.urgency}
Model Reason: ${choice.reason}
Operator Depth Bias: ${profile?.decisionProfile?.depthBias ?? "deep"}
Operator Speed Bias: ${profile?.decisionProfile?.speedBias ?? "balanced"}
Correctness Priority: ${profile?.decisionProfile?.correctnessPriority ?? "strict"}
Time Sensitivity: ${profile?.decisionProfile?.timeSensitivity ?? "adaptive"}
Preferred Reasoning Mode: ${profile?.routingHints?.preferredReasoningMode ?? "structured"}
  `.trim();

  switch (choice.provider) {
    case "deepseek":
      return runDeepSeek({ message: task.input, systemPrompt });

    case "groq":
      return runGroq({ message: task.input, systemPrompt });

    case "openai":
      return runOpenAI({ message: task.input, systemPrompt });

    case "anthropic":
      return runAnthropic({ message: task.input, systemPrompt });

    case "gemini":
      return runGemini({ message: task.input, systemPrompt });

    case "xai":
      return runXAI({ message: task.input, systemPrompt });

    default:
      return runDeepSeek({ message: task.input, systemPrompt });
  }
}
