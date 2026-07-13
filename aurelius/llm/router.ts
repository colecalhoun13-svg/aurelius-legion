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
import {
  BASE_PERSONA_PROMPT,
  OPERATOR_PERSONAS,
  KNOWLEDGE_UPDATE_GUIDANCE,
} from "../persona/aureliusPersona.ts";
import { formatIntentClassesForPrompt } from "../knowledge/intentClasses.ts";
import { formatPendingProposalsForPrompt } from "../knowledge/proposals.ts";
import { semanticRecall, formatRecallForPrompt } from "../retrieval/retrieve.ts";
import { resolveOperatorId } from "../knowledge/store.ts";
import { getCorpusAwareness } from "../corpus/ingest.ts";
import { IDENTITY } from "../identity/index.ts";
import {
  loadMemoriesForOperator,
  formatMemoriesForPrompt,
} from "../memory/memoryService.ts";
import { buildToolCatalog } from "../tools/toolRegistry.ts";

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
  // Phase 4.5 — Knowledge update propose/confirm context
  knowledgeContext?: {
    operatorId: string;
    operatorName: string;
  };
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
  /** Set when the routed provider failed and another served the call. */
  failedOverFrom?: string;
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
  strategic:     { provider: "anthropic", model: "claude-sonnet-5" },
  highLeverage:  { provider: "anthropic", model: "claude-opus-4-8" },
  realtime:      { provider: "xai",       model: "grok-4-1-fast-reasoning" },
  multimodal:    { provider: "gemini",    model: "gemini-2.5-pro" },
  mathCheap:     { provider: "deepseek",  model: "deepseek-reasoner" },
};

const ENGINE_ALIASES: Record<string, { provider: string; model: string }> = {
  "claude-opus":   { provider: "anthropic", model: "claude-opus-4-8" },
  "claude-sonnet": { provider: "anthropic", model: "claude-sonnet-5" },
  // Fable 5 is premium-priced ($10/$50 per MTok) — explicit override only,
  // never auto-routed. For the hardest long-horizon reasoning when Cole asks.
  "claude-fable":  { provider: "anthropic", model: "claude-fable-5" },
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

  return { ...TIERS.strategic, reason: "Default strategic routing → Claude Sonnet 5 (Aurelius default)." };
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

  // Layer 1.5: Operator state — score + learned calibration, one voice.
  // No modes: the register modulates from live state and from persona.*
  // entries Cole has confirmed, never from a persona switch.
  try {
    const { getOperatorStateBlock } = await import("../measurement/operatorScore.ts");
    const stateBlock = await getOperatorStateBlock();
    if (stateBlock) parts.push("\n" + stateBlock);
  } catch (err) {
    console.warn("[router] operator state block failed (non-fatal):", err);
  }

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

  // Layer 5.25: Recent conversation — short-term continuity. The last few
  // persisted turns, so "like we discussed" survives restarts and devices.
  try {
    const { recentConversationBlock } = await import("../memory/conversation.ts");
    const convo = await recentConversationBlock();
    if (convo) parts.push("\n" + convo);
  } catch (err) {
    console.warn("[ROUTER] conversation continuity failed (non-fatal):", err);
  }

  // Resolve the primary operator's id once — shared by the compiled-pattern
  // layer (5.4) and semantic recall (5.5).
  const recallOperatorId =
    task.knowledgeContext?.operatorId ??
    (await resolveOperatorId(operators.primary).catch(() => null)) ??
    undefined;

  // Layer 5.4: Compiled patterns — accumulated understanding.
  // Closes the learning loop for the MAIN brain: confirmed heuristics that
  // Aurelius compiled from repeated experience now ground everyday reasoning,
  // not just the training reasoner. No-op until patterns exist; never fatal.
  if (recallOperatorId) {
    try {
      const { loadOperatorPatternsForPrompt } = await import("../compiled/reasoningHelper.ts");
      const patternBlock = await loadOperatorPatternsForPrompt({
        operatorId: recallOperatorId,
        limit: 10,
      });
      if (patternBlock) parts.push("\n" + patternBlock);
    } catch (err) {
      console.warn("[ROUTER] compiled-pattern layer failed (non-fatal):", err);
    }
  }

  // Layer 5.5 (Phase 4.6): Semantic recall — retrieval-augmented context.
  // Embeds the user's message and surfaces the closest knowledge, memories,
  // and prior reasoning. No-op when embeddings are disabled; never fatal.
  try {
    const hits = await semanticRecall({
      query: task.input,
      operatorId: recallOperatorId,
      limit: 8,
    });
    const recallBlock = formatRecallForPrompt(hits);
    if (recallBlock) {
      parts.push("\n" + recallBlock);
    }
  } catch (err) {
    console.warn("[ROUTER] semantic recall failed (non-fatal):", err);
  }

  // Layer 5.75: Corpus awareness — Aurelius knows what it has ingested,
  // unprompted. The contents surface via recall; this is the table of
  // contents of its own mind.
  try {
    const awareness = await getCorpusAwareness();
    if (awareness) parts.push("\n" + awareness);
  } catch (err) {
    console.warn("[ROUTER] corpus awareness failed (non-fatal):", err);
  }

  // Layer 6: Tool catalog (auto-generated from registered tool adapters)
  try {
    const toolCatalog = buildToolCatalog();
    if (toolCatalog) {
      parts.push("\n═══ " + toolCatalog);
    }
  } catch (err) {
    console.warn("[ROUTER] tool catalog generation failed:", err);
  }

  // Layer 7: Task context
  const context: string[] = [];
  if (task.autonomyMode) context.push(`Autonomy mode: ${task.autonomyMode}`);
  if (task.urgency) context.push(`Urgency: ${task.urgency}`);
  if (context.length > 0) {
    parts.push("\n═══ CONTEXT ═══\n" + context.join("\n"));
  }

  // Layer 7.5 (Phase 4.5): Knowledge update guidance — propose/confirm flow
  if (task.knowledgeContext) {
    const { operatorId, operatorName } = task.knowledgeContext;
    const knowledgeLines: string[] = [];
    knowledgeLines.push("\n═══ KNOWLEDGE UPDATE FLOW ═══");
    knowledgeLines.push(KNOWLEDGE_UPDATE_GUIDANCE);

    const intentClassesSection = formatIntentClassesForPrompt(operatorName);
    if (intentClassesSection) {
      knowledgeLines.push("");
      knowledgeLines.push(intentClassesSection);
    }

    const pendingSection = await formatPendingProposalsForPrompt(operatorId);
    if (pendingSection) {
      knowledgeLines.push("");
      knowledgeLines.push(pendingSection);
    }

    parts.push(knowledgeLines.join("\n"));
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
//
// Provider failover: one provider erroring degrades the model choice,
// never the answer. On failure (thrown error OR a keyless "not
// configured" response) the call walks the other CONFIGURED providers
// in order. All-fail keeps honest failure — one loud line.

const PROVIDER_KEYS: Record<string, string> = {
  anthropic: "ANTHROPIC_API_KEY",
  openai: "OPENAI_API_KEY",
  groq: "GROQ_API_KEY",
  gemini: "GEMINI_API_KEY",
  deepseek: "DEEPSEEK_API_KEY",
  xai: "XAI_API_KEY",
};
const FALLBACK_ORDER = ["anthropic", "openai", "groq", "gemini", "deepseek", "xai"];
const FALLBACK_MODELS: Record<string, string> = {
  anthropic: "claude-sonnet-5",
  openai: "gpt-5.4-mini",
  groq: "llama-3.3-70b-versatile",
  gemini: "gemini-2.5-pro",
  deepseek: "deepseek-reasoner",
  xai: "grok-4-1-fast-reasoning",
};
const MAX_ATTEMPTS = 3;

function providerConfigured(p: string): boolean {
  return !!process.env[PROVIDER_KEYS[p] ?? ""]?.trim();
}

function engineUnavailableText(text: string): boolean {
  return /engine is not configured|Missing .*_API_KEY/i.test(text);
}

// Anything that isn't a usable answer → the router should fail over to the next
// engine. Covers: empty/blank text, a missing key, and adapter-level API/fetch
// errors (which the adapters return as a short "<Provider> error: ..." string —
// e.g. a small-context model rejecting a long prompt).
export function isNonAnswer(text: string): boolean {
  if (!text || !text.trim()) return true;
  if (engineUnavailableText(text)) return true;
  return /^(Anthropic|OpenAI|Gemini|Groq|DeepSeek|xAI) (API )?(error|engine encountered an error|fetch error)/i.test(
    text.trim()
  );
}

export async function routeLLM(task: LLMTask): Promise<LLMResponse> {
  const choice = chooseModel(task);
  const systemPrompt = await buildSystemPrompt(task);

  // Compose log line that shows multi-operator context if present
  const opCtx = task.operators
    ? `${task.operators.primary}${task.operators.secondaries.length ? ` + [${task.operators.secondaries.join(", ")}]` : ""}`
    : task.operator ?? "n/a";

  console.log(`[ROUTER] ${choice.provider}/${choice.model} — ${choice.reason} | operators: ${opCtx}`);

  // Attempt chain: the routed choice, then every OTHER configured
  // provider in fallback order. A keyless deployment gets a chain of
  // one — exactly the old behavior, honest failure included.
  const chain: Array<{ provider: string; model: string }> = [
    { provider: choice.provider, model: choice.model },
    ...FALLBACK_ORDER.filter((p) => p !== choice.provider && providerConfigured(p)).map((p) => ({
      provider: p,
      model: FALLBACK_MODELS[p],
    })),
  ].slice(0, MAX_ATTEMPTS);

  let primary: { text: string; tokensUsed: number; latencyMs: number } | null = null;
  let served = chain[0];
  let failedOver = false;
  let lastFailure = "unknown";

  for (const attempt of chain) {
    const isLast = attempt === chain[chain.length - 1];
    try {
      const result = await runAdapter(attempt.provider, attempt.model, systemPrompt, task.input);
      // Fail over on anything that isn't a real answer: a missing key, an
      // adapter-level API error (e.g. a small-context model choking on a long
      // prompt), or an EMPTY response. Only accept a non-answer on the last
      // attempt, so the user still gets an honest message rather than a hang.
      if (isNonAnswer(result.text) && !isLast) {
        lastFailure = result.text?.trim() || "empty response";
        console.warn(
          `[ROUTER] ${attempt.provider}/${attempt.model} gave no usable answer (${lastFailure.slice(0, 80)}) — falling over`
        );
        failedOver = true;
        continue;
      }
      primary = result;
      served = attempt;
      break;
    } catch (err) {
      lastFailure = (err as any)?.message ?? String(err);
      console.warn(
        `[ROUTER] ${attempt.provider}/${attempt.model} failed (${lastFailure}) — ${isLast ? "chain exhausted" : "falling over"}`
      );
      failedOver = true;
    }
  }

  if (!primary) {
    // Every configured provider threw — honest failure, one loud line.
    primary = {
      text: `All configured LLM providers failed (${chain.map((c) => c.provider).join(" → ")}). Last error: ${lastFailure}`,
      tokensUsed: 0,
      latencyMs: 0,
    };
    served = chain[0];
  }

  const response: LLMResponse = {
    text: primary.text,
    engine: served.provider,
    model: served.model,
    tokensUsed: primary.tokensUsed,
    latencyMs: primary.latencyMs,
    failedOverFrom: failedOver && served.provider !== choice.provider ? choice.provider : undefined,
  };

  if (task.options?.reviewer === "claude-opus") {
    const reviewerModel = "claude-opus-4-8";
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