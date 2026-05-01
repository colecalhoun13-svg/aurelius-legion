/**
 * Aurelius OS — Hybrid LLM Router
 *
 * Philosophy: cost-effective but right for the job.
 * Fit wins. Cost breaks ties between similarly-fit engines.
 *
 * Multi-operator support: a request has ONE primary operator (drives voice and full lens)
 * plus 0-2 secondary operators (contribute principles + constraints, don't drive voice).
 * The LLM brings reasoning. The operator core(s) provide the frame(s).
 */

import { gptAdapter } from "../engines/gptEngine.ts";
import { groqAdapter } from "../engines/groqEngine.ts";
import { anthropicAdapter } from "../engines/anthropicEngine.ts";
import { geminiAdapter } from "../engines/geminiEngine.ts";
import { xaiAdapter } from "../engines/xaiClient.ts";
import { deepseekAdapter } from "../engines/deepseekEngine.ts";
import { getOperatorProfile } from "../core/operatorProfiles.ts";
import { BASE_PERSONA_PROMPT, OPERATOR_PERSONAS } from "../persona/aureliusPersona.ts";
import { IDENTITY } from "../identity/index.ts";
import {
  loadMemoriesForOperator,
  formatMemoriesForPrompt,
} from "../memory/memoryService.ts";

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

export type LLMOptions = {
  engine?: string;
  reviewer?: string;
};

export type OperatorContext = {
  primary: string;
  secondaries: string[];
};

export type LLMTask = {
  taskType: string;
  operators?: OperatorContext;     // multi-operator context
  operator?: string;               // legacy field — used as primary if `operators` not supplied
  autonomyMode?: string;
  urgency?: "low" | "medium" | "high";
  input: string;
  options?: LLMOptions;
  needsRealtime?: boolean;
  hasMultimodal?: boolean;
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
// TIER MAPPING
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

const ENGINE_ALIASES: Record<string, { provider: string; model: string }> = {
  "claude-opus":   { provider: "anthropic", model: "claude-opus-4-7" },
  "claude-sonnet": { provider: "anthropic", model: "claude-sonnet-4-6" },
  "gpt":           { provider: "openai",    model: "gpt-5.4-mini" },
  "gpt-pro":       { provider: "openai",    model: "gpt-5.4" },
  "groq":          { provider: "groq",      model: "llama-3.3-70b-versatile" },
  "grok":          { provider: "xai",       model: "grok-4-1-fast-reasoning" },
  "gemini":        { provider: "gemini",    model: "gemini-2.5-pro" },
  "deepseek":      { provider: "deepseek",  model: "deepseek-reasoner" },
};

// ═══════════════════════════════════════════════════════════════════
// MODEL SELECTION
// ═══════════════════════════════════════════════════════════════════

export function chooseModel(task: LLMTask): LLMChoice {
  if (task.options?.engine) {
    const alias = ENGINE_ALIASES[task.options.engine];
    if (alias) {
      return {
        provider: alias.provider,
        model: alias.model,
        reason: `Explicit override: options.engine = "${task.options.engine}"`,
      };
    }
    console.warn(`[ROUTER] Unknown engine alias "${task.options.engine}" — auto-routing`);
  }

  if (task.needsRealtime) {
    return { ...TIERS.realtime, reason: "Real-time info needed → Grok with live search." };
  }

  if (task.hasMultimodal) {
    return { ...TIERS.multimodal, reason: "Multimodal input detected → Gemini." };
  }

  const fastTaskTypes = ["log", "extract", "track", "quick_reply", "summary", "rewrite"];
  if (fastTaskTypes.includes(task.taskType)) {
    return { ...TIERS.fast, reason: `Task type "${task.taskType}" is fit for speed-first → Groq.` };
  }

  const mathCodeTaskTypes = ["math", "code_heavy"];
  if (mathCodeTaskTypes.includes(task.taskType)) {
    return { ...TIERS.mathCheap, reason: `Task type "${task.taskType}" → DeepSeek reasoner.` };
  }

  if (task.taskType === "structured" || task.taskType === "json") {
    return { ...TIERS.structured, reason: `Task type "${task.taskType}" → GPT-5.4-mini.` };
  }

  return { ...TIERS.strategic, reason: "Default strategic routing → Claude Sonnet 4.6 (Aurelius default)." };
}

// ═══════════════════════════════════════════════════════════════════
// IDENTITY FORMATTING
// ═══════════════════════════════════════════════════════════════════

function formatIdentityForPrompt(): string {
  const p = IDENTITY.profile;
  const pref = IDENTITY.preferences;

  const lines = [
    "═══ ABOUT COLE ═══",
    `Name: ${p.name}`,
    `Identity: ${p.identity.join(", ")}`,
    `Roles: ${p.roles.join(", ")}`,
    "",
    "═══ HOW HE WANTS YOU TO ENGAGE ═══",
    `Communication: ${pref.communication.style}. Formality: ${pref.communication.formality}.`,
    `Cussing: ${pref.communication.cussingFrequency}.`,
    `Named address: ${pref.communication.namedAddress}.`,
    "",
    "Reasoning expectations:",
    `  — Pushback expected: ${pref.reasoning.expectsPushback}`,
    `  — Honesty: ${pref.reasoning.expectsHonesty}`,
    `  — Brevity: ${pref.reasoning.expectsBrevity}`,
    `  — Structure: ${pref.reasoning.structurePreference}`,
    "",
    "Work context:",
    `  — Rhythm: ${pref.work.rhythm}`,
    `  — Current motto: "${pref.work.motto}"`,
  ];

  return lines.join("\n");
}

// ═══════════════════════════════════════════════════════════════════
// OPERATOR CORE FORMATTING
// ═══════════════════════════════════════════════════════════════════

/**
 * Full core for the primary operator: principles, constraints, heuristics, questions.
 * This is the dominant lens — Aurelius reasons through this and uses its tone.
 */
function formatPrimaryOperatorCore(operatorName: string): string {
  const profile = getOperatorProfile(operatorName);
  if (!profile) return "";

  const lines: string[] = [`═══ PRIMARY OPERATOR: ${operatorName} ═══`];

  // Operator persona extension if it exists
  const ext = OPERATOR_PERSONAS[operatorName];
  if (ext) {
    lines.push(ext);
    lines.push("");
  }

  if (profile.principles?.length) {
    lines.push("PRINCIPLES (apply these to your reasoning):");
    profile.principles.forEach((p: string, i: number) => {
      lines.push(`  ${i + 1}. ${p}`);
    });
    lines.push("");
  }

  if (profile.constraints?.length) {
    lines.push("CONSTRAINTS (do not violate):");
    profile.constraints.forEach((c: string, i: number) => {
      lines.push(`  ${i + 1}. ${c}`);
    });
    lines.push("");
  }

  if (profile.heuristics?.length) {
    lines.push("HEURISTICS (use where they fit):");
    profile.heuristics.forEach((h: string) => {
      lines.push(`  — ${h}`);
    });
    lines.push("");
  }

  if (profile.questions?.length) {
    lines.push("CLARIFYING QUESTIONS (ask when genuinely stuck):");
    profile.questions.forEach((q: string) => {
      lines.push(`  — ${q}`);
    });
  }

  return lines.join("\n").trimEnd();
}

/**
 * Trimmed core for secondary operators: only principles + constraints.
 * They contribute their hard rules without fighting for tone or driving reasoning.
 */
function formatSecondaryOperatorCore(operatorName: string): string {
  const profile = getOperatorProfile(operatorName);
  if (!profile) return "";

  const lines: string[] = [];
  let hasContent = false;

  if (profile.principles?.length) {
    lines.push(`${operatorName} — principles to respect:`);
    profile.principles.forEach((p: string) => {
      lines.push(`  — ${p}`);
    });
    hasContent = true;
  }

  if (profile.constraints?.length) {
    if (hasContent) lines.push("");
    lines.push(`${operatorName} — constraints to honor:`);
    profile.constraints.forEach((c: string) => {
      lines.push(`  — ${c}`);
    });
    hasContent = true;
  }

  return hasContent ? lines.join("\n") : "";
}

// ═══════════════════════════════════════════════════════════════════
// SYSTEM PROMPT ASSEMBLY (multi-operator)
// ═══════════════════════════════════════════════════════════════════

async function buildSystemPrompt(task: LLMTask): Promise<string> {
  const parts: string[] = [];

  // Resolve operator context (back-compat: legacy task.operator becomes primary)
  const operators: OperatorContext = task.operators ?? {
    primary: task.operator ?? "strategy",
    secondaries: [],
  };

  // Layer 1: Base persona
  parts.push(BASE_PERSONA_PROMPT);

  // Layer 2: Identity
  parts.push("\n" + formatIdentityForPrompt());

  // Layer 3: Primary operator (full core + lens extension + tone)
  const primaryBlock = formatPrimaryOperatorCore(operators.primary);
  if (primaryBlock) {
    parts.push("\n" + primaryBlock);
  }

  // Layer 4: Secondary operators (trimmed cores: principles + constraints only)
  if (operators.secondaries.length > 0) {
    const secondaryBlocks: string[] = ["═══ ALSO TOUCHING THIS REQUEST ═══"];
    for (const sec of operators.secondaries) {
      const block = formatSecondaryOperatorCore(sec);
      if (block) {
        secondaryBlocks.push("");
        secondaryBlocks.push(block);
      }
    }
    if (secondaryBlocks.length > 1) {
      parts.push("\n" + secondaryBlocks.join("\n"));
    }
  }

  // Layer 5: Memory (loaded for primary operator; relations-aware so secondaries surface naturally)
  try {
    const memories = await loadMemoriesForOperator({
      operator: operators.primary,
      userMessage: task.input,
    });
    const memoryBlock = formatMemoriesForPrompt(memories);
    if (memoryBlock) {
      parts.push("\n" + memoryBlock);
    }
  } catch (err) {
    console.warn("[ROUTER] memory load failed:", err);
  }

  // Layer 6: Task context
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
  const response = await adapter.run({ model, systemPrompt, userPrompt });
  const latencyMs = Date.now() - start;

  return {
    text: response.text || "",
    tokensUsed: response.tokensUsed || 0,
    latencyMs,
  };
}

// ═══════════════════════════════════════════════════════════════════
// MAIN ENTRY POINT
// ═══════════════════════════════════════════════════════════════════

export async function routeLLM(task: LLMTask): Promise<LLMResponse> {
  const choice = chooseModel(task);
  const systemPrompt = await buildSystemPrompt(task);

  // Compose log line that shows multi-operator context if present
  const opCtx = task.operators
    ? `${task.operators.primary}${task.operators.secondaries.length ? ` + [${task.operators.secondaries.join(", ")}]` : ""}`
    : task.operator ?? "n/a";

  console.log(`[ROUTER] ${choice.provider}/${choice.model} — ${choice.reason} | operators: ${opCtx}`);

  const primary = await runAdapter(choice.provider, choice.model, systemPrompt, task.input);

  const response: LLMResponse = {
    text: primary.text,
    engine: choice.provider,
    model: choice.model,
    tokensUsed: primary.tokensUsed,
    latencyMs: primary.latencyMs,
  };

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

    const reviewed = await runAdapter("anthropic", reviewerModel, reviewerSystemPrompt, reviewerUserPrompt);

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