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
import { nativeToolsFor, parseNativeToolCalls } from "./nativeTools.ts";
import { CACHE_BREAK } from "./promptMarkers.ts";
import type { ToolDirective } from "./directiveParser.ts";

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

export type LLMOptions = {
  engine?: string;
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
  decisionMode?: boolean;          // Cole is asking a real call → run the frameworks, don't quote
  // Attach the native invoke_tool function on directive-capable providers so
  // tool calls arrive structured instead of regex-parsed from prose.
  nativeTools?: boolean;
  // Skip the ~21KB tool catalog for calls whose output strips directives
  // anyway (wiki synthesis and kin) — pure token savings, zero behavior loss.
  omitToolCatalog?: boolean;
  // Keep this call out of the semantic reuse cache, both sides (post-sweep
  // council): internal synthesis jobs (wiki/briefing/planning voice) have
  // near-identical inputs run-to-run — reuse would silently freeze their
  // output for FRESH_DAYS and pollute the chat namespace.
  noReuse?: boolean;
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
  /** Native invoke_tool calls the provider returned as STRUCTURED objects —
   *  already normalized to the ToolDirective shape the executor runs. */
  toolCalls?: import("./directiveParser.ts").ToolDirective[];
  /** Set when the routed provider failed and another served the call. */
  failedOverFrom?: string;
  };

// Model IDs live in a leaf module so the doctor probes the SAME model the
// router uses, and so an account without access to the default is one env var
// (ANTHROPIC_CHAT_MODEL) away from working rather than a code change.
import { ANTHROPIC_DEFAULT_MODEL, ANTHROPIC_OPUS_MODEL, DEFAULT_TIER, FRONTIER_MODELS } from "./modelConfig.ts";

// ═══════════════════════════════════════════════════════════════════
// TIER MAPPING
// ═══════════════════════════════════════════════════════════════════

const TIERS = {
  fast:          { provider: "groq",      model: "llama-3.3-70b-versatile" },
  structured:    { provider: "openai",    model: "gpt-5.4-mini" },
  strategic:     { provider: DEFAULT_TIER.provider, model: ANTHROPIC_DEFAULT_MODEL },
  // ON DEMAND ONLY. Nothing auto-routes here and nothing should: Opus is what
  // Cole reaches for when HE decides a problem deserves it. Reached through the
  // `claude-opus` alias — i.e. the "/deep" marker on any message, on any
  // surface. An automatic version of this was built and removed: it changed
  // what he spends without him asking, which is his call and not the router's.
  highLeverage:  { provider: "anthropic", model: ANTHROPIC_OPUS_MODEL },
  realtime:      { provider: "xai",       model: "grok-4-1-fast-reasoning" },
  multimodal:    { provider: "gemini",    model: "gemini-2.5-pro" },
  mathCheap:     { provider: "deepseek",  model: "deepseek-reasoner" },
};

const ENGINE_ALIASES: Record<string, { provider: string; model: string }> = {
  "claude-opus":   { provider: "anthropic", model: ANTHROPIC_OPUS_MODEL },
  "claude-sonnet": { provider: "anthropic", model: ANTHROPIC_DEFAULT_MODEL },
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

  // ── STATIC PREFIX (final council, efficiency seat) ──────────────────
  // Layers 1/2/3/4/6 are byte-identical for a given operator combination,
  // so they lead the prompt and get cached by capable providers (the
  // Anthropic adapter marks everything above CACHE_BREAK with
  // cache_control). Dynamic layers follow the break. Semantic layer
  // numbering is unchanged — only the assembly order moved.

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

  // Layer 6: Tool catalog — static, so it lives in the cached prefix. Gated:
  // task types that strip directives afterwards (wiki synthesis and kin) set
  // omitToolCatalog and skip its ~21KB entirely (final council).
  if (!task.omitToolCatalog) {
    try {
      const toolCatalog = buildToolCatalog();
      if (toolCatalog) {
        parts.push("\n═══ " + toolCatalog);
        if (task.nativeTools) {
          parts.push(
            "\nWhen you need a tool, PREFER calling the invoke_tool function with { tool, action, data } exactly as cataloged above — it cannot be mis-parsed. The [TOOL: ...] text form remains a working fallback."
          );
        }
      }
    } catch (err) {
      console.warn("[ROUTER] tool catalog generation failed:", err);
    }
  }

  // ── CACHE BREAK — everything below changes per call ─────────────────
  parts.push("\n" + CACHE_BREAK);

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

  // Layer 2.4: NOW — the brain knows what time it is (final council). Clock,
  // next events with countdowns, today's load, standing grants. 60s-cached
  // body, fresh clock line; never fatal.
  try {
    const { buildNowBlock } = await import("../core/nowContext.ts");
    const nowBlock = await buildNowBlock();
    if (nowBlock) parts.push("\n" + nowBlock);
  } catch (err) {
    console.warn("[ROUTER] NOW layer failed (non-fatal):", err);
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
      const fired: string[] = []; // outcome loop: which rules informed this turn
      // Primary lens — its frameworks, fit-ranked to THIS decision (not top-N by
      // confidence), so the ones that actually bear on the question are what load.
      const patternBlock = await loadOperatorPatternsForPrompt({
        operatorId: recallOperatorId,
        limit: 10,
        role: "primary",
        query: task.input,
        fired,
      });
      if (patternBlock) parts.push("\n" + patternBlock);

      // Secondary lenses bring THEIR frameworks too — so the lenses that should
      // collide on a real decision actually do, instead of the primary reasoning
      // alone. Thinner (they contribute, they don't dominate).
      for (const sec of operators.secondaries ?? []) {
        const secId = await resolveOperatorId(sec).catch(() => null);
        if (!secId || secId === recallOperatorId) continue;
        const secBlock = await loadOperatorPatternsForPrompt({
          operatorId: secId,
          limit: 4,
          role: "secondary",
          query: task.input,
          fired,
        });
        if (secBlock) parts.push("\n" + secBlock);
      }

      // Real decision → record which rules informed it (fire-and-forget; joins the
      // request's trace thread). This is the audit trail AND the outcome loop's
      // input: corrections decay exactly these, quiet weeks reinforce them.
      if (task.decisionMode && fired.length > 0) {
        import("../compiled/outcomeLoop.ts")
          .then(({ recordPatternsFired }) => recordPatternsFired(fired, task.input))
          .catch(() => {});
      }
    } catch (err) {
      console.warn("[ROUTER] compiled-pattern layer failed (non-fatal):", err);
    }
  }

  // Layer 5.35: COLE'S BUSINESS FACTS — injected whenever the business or
  // content lens is in play, so those turns reason from what Cole actually
  // said (and can SEE what's still unknown) instead of re-deriving a generic
  // youth-performance persona every time. Never fatal, empty until seeded.
  if ([operators.primary, ...(operators.secondaries ?? [])].some((o) => o === "business" || o === "content")) {
    try {
      const { businessContextBlock } = await import("../business/positioning.ts");
      const bizBlock = await businessContextBlock();
      if (bizBlock) parts.push("\n" + bizBlock);
    } catch (err) {
      console.warn("[ROUTER] business context layer failed (non-fatal):", err);
    }
  }

  // Layer 5.45: the primary operator's FIELD SYNTHESIS — its best current
  // understanding of the domain (the wiki page the curriculum keeps rewriting),
  // injected directly so it's ALWAYS reasoned from, not left to chance whether a
  // random chunk of it happens to surface in recall. Bounded; never fatal.
  try {
    const { prisma } = await import("../core/db/prisma.ts");
    const slugs = [operators.primary, ...(operators.secondaries ?? [])];
    const pages = await prisma.wikiPage.findMany({
      where: { slug: { in: slugs } },
      select: { slug: true, title: true, content: true },
    });
    const bySlug = new Map(pages.map((p) => [p.slug, p]));
    for (const slug of slugs) {
      const page = bySlug.get(slug);
      if (!page?.content || page.content.trim().length <= 40) continue;
      const isPrimary = slug === operators.primary;
      const top = page.content.trim().slice(0, isPrimary ? 1400 : 500);
      parts.push(
        `\n═══ FIELD SYNTHESIS · ${page.title}${isPrimary ? "" : " (secondary lens)"} ═══\n${top}\n\nReason from this synthesis where it applies; update it if new evidence contradicts it.`
      );
    }
  } catch (err) {
    console.warn("[ROUTER] field synthesis layer failed (non-fatal):", err);
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

  // DECISION MODE — the application harness. When Cole is making a real call, this
  // forces the model to RUN the frameworks above on his specifics rather than
  // recall or quote them. The `Lens:` line is the honesty check: a framework is
  // only applied if deleting its name would weaken the answer (if the same
  // conclusion survives without it, it was decoration). Placed last so it's the
  // final instruction the model reads before answering.
  if (task.decisionMode) {
    parts.push(
      `\n═══ DECISION MODE ═══\n` +
      `Cole is making a real decision. Reason THROUGH the frameworks above — apply their logic to give him the single best answer, not a generic one.\n` +
      `Do this in your own thinking, silently: identify which frameworks genuinely bear on THIS decision; run each on his actual specifics; notice what they RULE OUT or force that intuition wouldn't; and where two point opposite ways, resolve the tension deliberately (don't average).\n` +
      `Then give him the answer that reasoning produces — clean, direct, and concrete.\n` +
      `The lens must be LOAD-BEARING but INVISIBLE: do NOT name-drop authors, quote the frameworks, or append a "Lens:" line. The test of real application is that deleting any framework's name from your answer would leave it just as strong — the wisdom shows up in the sharpness of the call, not in citations. Let the study make the answer better, not louder.`
    );
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
  userPrompt: string,
  withNativeTools = false
): Promise<{ text: string; tokensUsed: number; latencyMs: number; toolCalls?: ToolDirective[] }> {
  const adapter = adapters[provider];
  if (!adapter) {
    throw new Error(`No adapter found for provider "${provider}"`);
  }

  const tools = withNativeTools ? nativeToolsFor(provider) : null;
  const start = Date.now();
  const response = await adapter.run({ model, systemPrompt, userPrompt, ...(tools ? { tools } : {}) });
  const latencyMs = Date.now() - start;

  const toolCalls = tools ? parseNativeToolCalls(provider, response.raw) : [];
  return {
    text: response.text || "",
    tokensUsed: response.tokensUsed || 0,
    latencyMs,
    ...(toolCalls.length ? { toolCalls } : {}),
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

// Directive capability (council fix): only format-reliable providers get
// "hands" — the right to have their [TOOL:]/[SAVE:] directives EXECUTED. All
// six providers keep their task types (core architecture); groq/deepseek/xai
// answer in prose. Failover preserves the class: a directive-bearing turn
// never silently lands on a prose-only model mid-conversation.
export const DIRECTIVE_CAPABLE = new Set(["anthropic", "openai", "gemini"]);
// TIER-AWARE FALLBACK (deploy triage). This used to be a flat provider→model
// map, so a STRATEGIC call that failed over to OpenAI landed on gpt-5.4-mini —
// the same throwaway model a `structured` call gets. Cole ran a week with
// ANTHROPIC_API_KEY unset on the backend: 192 of 212 calls failed over, and
// every one of them was frontier reasoning silently served by a mini model.
// Nothing errored; the briefings just got shallower.
//
// A fallback must preserve the TIER, not just the provider. When the routed
// choice was strategic or high-leverage, the substitute is the full model.
const FALLBACK_MODELS: Record<string, string> = {
  anthropic: "claude-sonnet-5",
  openai: "gpt-5.4-mini",
  groq: "llama-3.3-70b-versatile",
  gemini: "gemini-2.5-pro",
  deepseek: "deepseek-reasoner",
  xai: "grok-4-1-fast-reasoning",
};
/** Substitutes used when the call being replaced was frontier-tier. */
const FRONTIER_FALLBACK_MODELS: Record<string, string> = {
  anthropic: ANTHROPIC_DEFAULT_MODEL,
  openai: "gpt-5.4",
  gemini: "gemini-2.5-pro",
};
/**
 * Was this routed choice frontier-tier — i.e. would a mini substitute be a
 * silent downgrade? Derived from the tier table, not from a provider name:
 * hardcoding "anthropic" here would break the moment the strategic tier moves,
 * which is the same failure mode this whole change exists to close.
 */
function isFrontierChoice(choice: { provider: string; model: string }): boolean {
  return FRONTIER_MODELS.has(choice.model);
}
function fallbackModelFor(provider: string, frontier: boolean): string {
  return (frontier && FRONTIER_FALLBACK_MODELS[provider]) || FALLBACK_MODELS[provider];
}
const MAX_ATTEMPTS = 3;

function providerConfigured(p: string): boolean {
  return !!process.env[PROVIDER_KEYS[p] ?? ""]?.trim();
}

// The honest-failure guard now lives in one leaf module (llm/nonAnswer.ts) so
// every call site shares one regex. Imported for local use (isNonAnswer) and
// re-exported to preserve the public API.
import { engineUnavailableText } from "./nonAnswer.ts";
export { engineUnavailableText };

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
  // Capability-preserving failover: when the routed choice can emit directives,
  // fallbacks must too — otherwise a mid-conversation failover hands the tool
  // catalog to a model whose directives we'd refuse (or worse, mangle silently).
  // Prose-only primaries (groq quick replies, deepseek math) fall back anywhere.
  const preserveDirectives = DIRECTIVE_CAPABLE.has(choice.provider);
  const frontier = isFrontierChoice(choice);
  const chain: Array<{ provider: string; model: string }> = [
    // DON'T BURN AN ATTEMPT ON A PROVIDER WE KNOW IS DEAD. The routed choice
    // used to go in unconditionally while only the FALLBACKS were filtered by
    // providerConfigured — so with Anthropic unconfigured every chain was
    // [anthropic(dead), openai, gemini] and one of three slots was spent on a
    // guaranteed miss. That's what manufactured all 192 failover records.
    ...(providerConfigured(choice.provider) ? [{ provider: choice.provider, model: choice.model }] : []),
    ...FALLBACK_ORDER.filter(
      (p) =>
        p !== choice.provider &&
        providerConfigured(p) &&
        (!preserveDirectives || DIRECTIVE_CAPABLE.has(p))
    ).map((p) => ({
      provider: p,
      model: fallbackModelFor(p, frontier),
    })),
    // Keyless deployment: keep the routed choice so the adapter returns its
    // honest "not configured" string rather than the chain being empty.
    ...(providerConfigured(choice.provider) ? [] : [{ provider: choice.provider, model: choice.model }]),
  ].slice(0, MAX_ATTEMPTS);

  let primary: { text: string; tokensUsed: number; latencyMs: number; toolCalls?: ToolDirective[] } | null = null;
  let served = chain[0];
  let failedOver = false;
  let lastFailure = "unknown";

  for (const attempt of chain) {
    const isLast = attempt === chain[chain.length - 1];
    try {
      const result = await runAdapter(
        attempt.provider,
        attempt.model,
        systemPrompt,
        task.input,
        // Never attach invoke_tool without its catalog (post-sweep guard):
        // a model with the function but no listing would call tools blind.
        !!task.nativeTools && !task.omitToolCatalog && DIRECTIVE_CAPABLE.has(attempt.provider)
      );
      // Fail over on anything that isn't a real answer: a missing key, an
      // adapter-level API error (e.g. a small-context model choking on a long
      // prompt), or an EMPTY response. Only accept a non-answer on the last
      // attempt, so the user still gets an honest message rather than a hang.
      // A turn with NATIVE TOOL CALLS is a real answer even with empty text —
      // the model chose to act instead of talk; the results turn writes the prose.
      if (result.toolCalls?.length) {
        primary = result;
        served = attempt;
        break;
      }
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
    toolCalls: primary.toolCalls?.length ? primary.toolCalls : undefined,
    failedOverFrom: failedOver && served.provider !== choice.provider ? choice.provider : undefined,
  };

  // (The "claude-opus reviewer" second pass was removed: it had ZERO call
  // sites anywhere in the repo, so ~50 lines of authoritative-looking code
  // could never run. Unreachable code that reads like a feature is the same
  // class of problem as a health check that hides a row — it tells you
  // something is there when nothing is. If a review-before-answer pass is
  // wanted, build it deliberately, with a failover chain and a real caller.)

  return response;
}