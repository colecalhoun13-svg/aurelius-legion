/**
 * Aurelius OS — Hybrid LLM Router
 *
 * Philosophy: cost-effective but right for the job.
 * Fit wins. Cost breaks ties between similarly-fit engines.
 * Never route to a wrong-fit engine just because it's cheap.
 *
 * The LLM brings reasoning. The operator core provides the frame.
 * Same LLM + different lens = different answer.
 */

import { gptAdapter } from "../engines/gptEngine.ts";
import { groqAdapter } from "../engines/groqEngine.ts";
import { anthropicAdapter } from "../engines/anthropicEngine.ts";
import { geminiAdapter } from "../engines/geminiEngine.ts";
import { xaiAdapter } from "../engines/xaiClient.ts";
import { deepseekAdapter } from "../engines/deepseekEngine.ts";
import { getOperatorProfile } from "../core/operatorProfiles.ts";
import { BASE_PERSONA_PROMPT, OPERATOR_PERSONAS } from "../persona/aureliusPersona.ts";

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

export type LLMOptions = {
  engine?: string;        // explicit engine override: "claude-opus", "gpt", "groq", etc.
  reviewer?: string;      // optional Opus oversight: "claude-opus" only
};

export type LLMTask = {
  taskType: string;       // "chat", "log", "research", "plan", "extract", "code", "math", etc.
  operator?: string;      // "strategy", "business", "athlete", etc.
  autonomyMode?: string;  // "reactive", "planning", "reflection"
  urgency?: "low" | "medium" | "high";
  input: string;
  options?: LLMOptions;
  needsRealtime?: boolean;  // explicit signal for real-time info need
  hasMultimodal?: boolean;  // explicit signal for image/video/audio input
};

export type LLMChoice = {
  provider: string;
  model: string;
  reason: string;
};

export type LLMResponse = {
  text: string;
  engine: string;
  model: string;
  tokensUsed: number;
  latencyMs: number;
  reviewed?: {
    reviewer: string;
    model: string;
    text: string;
    tokensUsed: number;
    latencyMs: number;
  };
};

// ═══════════════════════════════════════════════════════════════════
// TIER MAPPING — current verified model names (April 2026)
// ═══════════════════════════════════════════════════════════════════

const TIERS = {
  fast:          { provider: "groq",      model: "llama-3.3-70b-versatile" },
  structured:    { provider: "openai",    model: "gpt-5.4-mini" },
  strategic:     { provider: "anthropic", model: "claude-sonnet-4-6" },
  highLeverage:  { provider: "anthropic", model: "claude-opus-4-7" },
  realtime:      { provider: "xai",       model: "grok-4-1-fast-reasoning" },
  multimodal:    { provider: "gemini",    model: "gemini-2.5-pro" },
  mathCheap:     { provider: "deepseek",  model: "deepseek-reasoner" },
};

// Explicit engine override aliases (used when options.engine is set)
const ENGINE_ALIASES: Record<string, { provider: string; model: string }> = {
  "claude-opus":    { provider: "anthropic", model: "claude-opus-4-7" },
  "claude-sonnet":  { provider: "anthropic", model: "claude-sonnet-4-6" },
  "gpt":            { provider: "openai",    model: "gpt-5.4-mini" },
  "gpt-pro":        { provider: "openai",    model: "gpt-5.4" },
  "groq":           { provider: "groq",      model: "llama-3.3-70b-versatile" },
  "grok":           { provider: "xai",       model: "grok-4-1-fast-reasoning" },
  "gemini":         { provider: "gemini",    model: "gemini-2.5-pro" },
  "deepseek":       { provider: "deepseek",  model: "deepseek-reasoner" },
};

// ═══════════════════════════════════════════════════════════════════
// MODEL SELECTION — fit-first rule-based logic
// ═══════════════════════════════════════════════════════════════════

export function chooseModel(task: LLMTask): LLMChoice {
  // 1. Explicit engine override wins
  if (task.options?.engine) {
    const alias = ENGINE_ALIASES[task.options.engine];
    if (alias) {
      return {
        provider: alias.provider,
        model: alias.model,
        reason: `Explicit override: options.engine = "${task.options.engine}"`,
      };
    }
    // Unknown alias — fall through to auto-routing but warn
    console.warn(`[ROUTER] Unknown engine alias "${task.options.engine}" — auto-routing`);
  }

  // 2. Real-time info signal → Grok (only engine with web/X live search)
  if (task.needsRealtime) {
    return {
      ...TIERS.realtime,
      reason: "Real-time info needed → Grok with live search.",
    };
  }

  // 3. Multimodal input → Gemini
  if (task.hasMultimodal) {
    return {
      ...TIERS.multimodal,
      reason: "Multimodal input detected → Gemini.",
    };
  }

  // 4. Clearly-fast tasks → Groq
  const fastTaskTypes = ["log", "extract", "track", "quick_reply", "summary", "rewrite"];
  if (fastTaskTypes.includes(task.taskType)) {
    return {
      ...TIERS.fast,
      reason: `Task type "${task.taskType}" is fit for speed-first → Groq.`,
    };
  }

  // 5. Math/code heavy → DeepSeek reasoner (cost-effective for this niche)
  const mathCodeTaskTypes = ["math", "code_heavy"];
  if (mathCodeTaskTypes.includes(task.taskType)) {
    return {
      ...TIERS.mathCheap,
      reason: `Task type "${task.taskType}" → DeepSeek reasoner (math/code fit).`,
    };
  }

  // 6. Structured output task → GPT-5.4-mini
  if (task.taskType === "structured" || task.taskType === "json") {
    return {
      ...TIERS.structured,
      reason: `Task type "${task.taskType}" → GPT-5.4-mini (structured output fit).`,
    };
  }

  // 7. Default → Claude Sonnet 4.6 (Aurelius's strategic default voice)
  return {
    ...TIERS.strategic,
    reason: "Default strategic routing → Claude Sonnet 4.6 (Aurelius default).",
  };
}

// ═══════════════════════════════════════════════════════════════════
// SYSTEM PROMPT ASSEMBLY — persona + operator lens + task context
// ═══════════════════════════════════════════════════════════════════

function buildSystemPrompt(task: LLMTask): string {
  const parts: string[] = [];

  // Layer 1: Base persona (identity, voice, rules)
  parts.push(BASE_PERSONA_PROMPT);

  // Layer 2: Operator lens (domain frame + principles)
  if (task.operator) {
    const operatorExtension = OPERATOR_PERSONAS[task.operator];
    if (operatorExtension) {
      parts.push("\n" + operatorExtension);
    }

    // Layer 3: Full operator core (principles, constraints, heuristics)
    const profile = getOperatorProfile(task.operator);
    if (profile) {
      const core: string[] = [];

      if (profile.principles?.length) {
        core.push("PRINCIPLES (apply these to your reasoning):");
        profile.principles.forEach((p: string, i: number) => {
          core.push(`  ${i + 1}. ${p}`);
        });
      }

      if (profile.constraints?.length) {
        core.push("\nCONSTRAINTS (do not violate):");
        profile.constraints.forEach((c: string, i: number) => {
          core.push(`  ${i + 1}. ${c}`);
        });
      }

      if (profile.heuristics?.length) {
        core.push("\nHEURISTICS (use where they fit):");
        profile.heuristics.forEach((h: string) => {
          core.push(`  — ${h}`);
        });
      }

      if (profile.questions?.length) {
        core.push("\nCLARIFYING QUESTIONS (ask when genuinely stuck):");
        profile.questions.forEach((q: string) => {
          core.push(`  — ${q}`);
        });
      }

      if (core.length > 0) {
        parts.push("\n═══ OPERATOR CORE ═══\n" + core.join("\n"));
      }
    }
  }

  // Layer 4: Task context (minimal, just what the LLM needs)
  const context: string[] = [];
  if (task.autonomyMode) context.push(`Autonomy mode: ${task.autonomyMode}`);
  if (task.urgency) context.push(`Urgency: ${task.urgency}`);
  if (context.length > 0) {
    parts.push("\n═══ CONTEXT ═══\n" + context.join("\n"));
  }

  return parts.join("\n");
}

// ═══════════════════════════════════════════════════════════════════
// ADAPTER DISPATCH
// ═══════════════════════════════════════════════════════════════════

const adapters: Record<string, any> = {
  openai:    gptAdapter,
  groq:      groqAdapter,
  anthropic: anthropicAdapter,
  gemini:    geminiAdapter,
  xai:       xaiAdapter,
  deepseek:  deepseekAdapter,
};

async function runAdapter(
  provider: string,
  model: string,
  systemPrompt: string,
  userPrompt: string
): Promise<{ text: string; tokensUsed: number; latencyMs: number }> {
  const adapter = adapters[provider];
  if (!adapter) {
    throw new Error(`No adapter found for provider "${provider}"`);
  }

  const start = Date.now();
  const response = await adapter.run({
    model,
    systemPrompt,
    userPrompt,
  });
  const latencyMs = Date.now() - start;

  return {
    text: response.text || "",
    tokensUsed: response.tokensUsed || 0,
    latencyMs,
  };
}

// ═══════════════════════════════════════════════════════════════════
// MAIN ENTRY POINT — routeLLM
// ═══════════════════════════════════════════════════════════════════

export async function routeLLM(task: LLMTask): Promise<LLMResponse> {
  const choice = chooseModel(task);
  const systemPrompt = buildSystemPrompt(task);

  console.log(`[ROUTER] ${choice.provider}/${choice.model} — ${choice.reason}`);

  // Run primary engine
  const primary = await runAdapter(
    choice.provider,
    choice.model,
    systemPrompt,
    task.input
  );

  const response: LLMResponse = {
    text: primary.text,
    engine: choice.provider,
    model: choice.model,
    tokensUsed: primary.tokensUsed,
    latencyMs: primary.latencyMs,
  };

  // Optional Opus oversight
  if (task.options?.reviewer === "claude-opus") {
    const reviewerModel = "claude-opus-4-7";
    const reviewerSystemPrompt = `
You are Aurelius operating as a high-leverage reviewer. Claude Sonnet (or another primary engine) just produced a response to Cole's request. Your job is to review it.

Review criteria:
  — Does the response actually answer what Cole asked?
  — Is the reasoning sound, or are there holes?
  — Does it match Aurelius's voice (tactical, precise, no fluff)?
  — Is anything missing that Cole needs?
  — Is anything included that Cole doesn't need?

Produce a refined version. Keep what worked. Fix what didn't. Match Aurelius's voice throughout. Do not announce that you are reviewing — just deliver the better response.
`.trim();

    const reviewerUserPrompt = `
Cole's original request:
${task.input}

Primary engine's response (${choice.provider}/${choice.model}):
${primary.text}

Produce your refined response now.
`.trim();

    const reviewed = await runAdapter(
      "anthropic",
      reviewerModel,
      reviewerSystemPrompt,
      reviewerUserPrompt
    );

    response.reviewed = {
      reviewer: "anthropic",
      model: reviewerModel,
      text: reviewed.text,
      tokensUsed: reviewed.tokensUsed,
      latencyMs: reviewed.latencyMs,
    };
  }

  return response;
}
