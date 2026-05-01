// aurelius/autonomy/reflectionEngine.ts
//
// Aurelius's reflection engine.
// Takes a memory event or recent history, produces operator-grade insights.
// Multi-operator aware: primary operator drives reflection lens,
// secondaries add context.
//
// Triggered by:
//   1. Auto-fire after meaningful memory writes (decisions, events, clients)
//   2. User-explicit reflection requests (taskType: "reflect")
//   3. (Phase 9) End-of-chain in autonomy orchestrator

import { runLLM } from "../llm/runLLM.ts";
import { saveMemory } from "../memory/memoryService.ts";
import type { FormattedMemory } from "../memory/memoryService.ts";
import { getOperatorProfile } from "../core/operatorProfiles.ts";

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

export type ReflectionTrigger =
  | "memory_write"     // auto: fired after a meaningful memory was saved
  | "user_explicit"    // manual: user asked for reflection
  | "chain_end";       // Phase 9: end of an autonomy chain

export type ReflectionInput = {
  trigger: ReflectionTrigger;
  primaryOperator: string;
  secondaryOperators?: string[];
  // The thing being reflected on:
  triggerMemory?: {                     // for memory_write trigger
    category: string;
    value: string;
  };
  recentHistory?: FormattedMemory[];    // for user_explicit trigger (or chain_end)
  userPrompt?: string;                  // optional extra prompt from user
};

export type ReflectionOutput = {
  insights: string[];        // 2-5 distinct insights extracted
  summary: string;           // 1-2 sentence summary of what reflection saw
  nextSteps?: string[];      // optional recommended next actions
  confidence: number;        // 0..1
  savedMemoryId?: string;    // if reflection was persisted, the memory id
};

// ═══════════════════════════════════════════════════════════════════
// LLM ERROR DETECTOR
// Catches API errors, rate limits, and other failure strings so we don't
// persist them as memory content.
// ═══════════════════════════════════════════════════════════════════

function looksLikeLLMError(text: string): boolean {
  if (!text) return true;
  const lower = text.toLowerCase();
  return (
    lower.includes("api error") ||
    lower.includes("credit balance") ||
    lower.includes("rate limit") ||
    lower.includes("authentication") ||
    lower.includes("unauthorized") ||
    lower.startsWith("error:") ||
    lower.includes("anthropic api error") ||
    lower.includes("openai api error") ||
    lower.includes("groq api error")
  );
}

// ═══════════════════════════════════════════════════════════════════
// CORE REFLECTION FUNCTION
// ═══════════════════════════════════════════════════════════════════

export async function reflect(input: ReflectionInput): Promise<ReflectionOutput> {
  const profile = getOperatorProfile(input.primaryOperator);
  const decision = profile?.decisionProfile;

  // Confidence baseline from operator's depth bias
  let confidence = 0.7;
  if (decision?.depthBias === "deep") confidence = 0.85;
  if (decision?.depthBias === "shallow") confidence = 0.55;

  // Build the reflection prompt
  const reflectionPrompt = buildReflectionPrompt(input);

  // Run LLM to produce the reflection. Default routing — primary operator's lens applies.
  const response = await runLLM({
    taskType: "reflect",
    operators: {
      primary: input.primaryOperator,
      secondaries: input.secondaryOperators ?? [],
    },
    input: reflectionPrompt,
    // Use strategic tier (Sonnet) for reflections — this is operator-grade work.
  });

  // Parse the response into structured insights
  const parsed = parseReflectionResponse(response.text);

  return {
    insights: parsed.insights,
    summary: parsed.summary,
    nextSteps: parsed.nextSteps,
    confidence,
  };
}

// ═══════════════════════════════════════════════════════════════════
// REFLECTION + PERSIST (convenience wrapper for auto-triggered reflections)
// ═══════════════════════════════════════════════════════════════════

export async function reflectAndSave(input: ReflectionInput): Promise<ReflectionOutput> {
  const result = await reflect(input);

  // Guard: if the LLM call errored, the "summary" is the error message.
  // Do NOT persist error strings as reflection memory. Just return the result.
  if (looksLikeLLMError(result.summary)) {
    console.warn("[reflectionEngine] LLM error detected, skipping save:", result.summary);
    return result;
  }

  // Build memory value: summary first, then insights as bullet list
  const memoryValue = formatReflectionForMemory(result, input);

  try {
    const saved = await saveMemory({
      operator: input.primaryOperator,
      category: "reflection",
      value: memoryValue,
      relatedOperators: input.secondaryOperators,
      metadata: {
        trigger: input.trigger,
        confidence: result.confidence,
        insightCount: result.insights.length,
        nextStepCount: result.nextSteps?.length ?? 0,
      },
    });

    if (saved) {
      result.savedMemoryId = saved.id;
    }
  } catch (err) {
    console.error("[reflectionEngine] save failed:", err);
  }

  return result;
}

// ═══════════════════════════════════════════════════════════════════
// PROMPT BUILDER
// ═══════════════════════════════════════════════════════════════════

function buildReflectionPrompt(input: ReflectionInput): string {
  const lines: string[] = [];

  switch (input.trigger) {
    case "memory_write":
      lines.push("A new memory was just saved. Reflect on it — what does it actually mean for Cole?");
      lines.push("");
      if (input.triggerMemory) {
        lines.push(`New memory:`);
        lines.push(`  Category: ${input.triggerMemory.category}`);
        lines.push(`  Value: ${input.triggerMemory.value}`);
      }
      break;

    case "user_explicit":
      lines.push("Cole has asked you to reflect on recent context. Surface the patterns and meaning.");
      lines.push("");
      if (input.userPrompt) {
        lines.push(`Cole's specific reflection request:`);
        lines.push(`  ${input.userPrompt}`);
        lines.push("");
      }
      if (input.recentHistory && input.recentHistory.length > 0) {
        lines.push("Recent memories to reflect on:");
        for (const m of input.recentHistory.slice(0, 15)) {
          lines.push(`  — [${m.category}] ${m.value}`);
        }
      }
      break;

    case "chain_end":
      lines.push("An autonomy chain just completed. Reflect on what happened and what it implies.");
      lines.push("");
      if (input.recentHistory && input.recentHistory.length > 0) {
        lines.push("Chain events:");
        for (const m of input.recentHistory) {
          lines.push(`  — [${m.category}] ${m.value}`);
        }
      }
      break;
  }

  lines.push("");
  lines.push("Produce the reflection in this exact format:");
  lines.push("");
  lines.push("SUMMARY: [one or two sentences capturing what just happened or what was reflected on]");
  lines.push("");
  lines.push("INSIGHTS:");
  lines.push("- [insight 1]");
  lines.push("- [insight 2]");
  lines.push("- [up to 5 total — only include ones with real signal]");
  lines.push("");
  lines.push("NEXT STEPS:");
  lines.push("- [optional — only include if there are concrete actions worth flagging]");
  lines.push("");
  lines.push("Be tactical. No filler. Match Aurelius's voice.");

  return lines.join("\n");
}

// ═══════════════════════════════════════════════════════════════════
// RESPONSE PARSER
// Extract structured fields from LLM's text response.
// ═══════════════════════════════════════════════════════════════════

type ParsedReflection = {
  summary: string;
  insights: string[];
  nextSteps: string[];
};

function parseReflectionResponse(text: string): ParsedReflection {
  const result: ParsedReflection = {
    summary: "",
    insights: [],
    nextSteps: [],
  };

  // Extract SUMMARY block
  const summaryMatch = text.match(/SUMMARY:\s*([\s\S]*?)(?=\n\s*INSIGHTS:|$)/i);
  if (summaryMatch) {
    result.summary = summaryMatch[1].trim();
  }

  // Extract INSIGHTS block
  const insightsMatch = text.match(/INSIGHTS:\s*([\s\S]*?)(?=\n\s*NEXT STEPS:|$)/i);
  if (insightsMatch) {
    result.insights = extractBulletItems(insightsMatch[1]);
  }

  // Extract NEXT STEPS block
  const nextMatch = text.match(/NEXT STEPS:\s*([\s\S]*)/i);
  if (nextMatch) {
    result.nextSteps = extractBulletItems(nextMatch[1]);
  }

  // Fallback: if parser found nothing structured, treat whole text as summary
  if (!result.summary && result.insights.length === 0) {
    result.summary = text.trim().split("\n")[0] ?? text.trim();
  }

  return result;
}

function extractBulletItems(block: string): string[] {
  return block
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("-") || line.startsWith("•") || line.startsWith("*"))
    .map((line) => line.replace(/^[-•*]\s*/, "").trim())
    .filter((line) => line.length > 0);
}

// ═══════════════════════════════════════════════════════════════════
// MEMORY FORMATTER
// ═══════════════════════════════════════════════════════════════════

function formatReflectionForMemory(result: ReflectionOutput, input: ReflectionInput): string {
  const parts: string[] = [];

  parts.push(result.summary);

  if (result.insights.length > 0) {
    parts.push("");
    parts.push("Insights:");
    for (const ins of result.insights) {
      parts.push(`  — ${ins}`);
    }
  }

  if (result.nextSteps && result.nextSteps.length > 0) {
    parts.push("");
    parts.push("Next steps:");
    for (const step of result.nextSteps) {
      parts.push(`  — ${step}`);
    }
  }

  // Annotate with trigger source for later auditing
  parts.push("");
  parts.push(`(reflection triggered by: ${input.trigger})`);

  return parts.join("\n");
}

// ═══════════════════════════════════════════════════════════════════
// ENGINE ADAPTER (for engine registry compatibility)
// ═══════════════════════════════════════════════════════════════════

import type { Engine, EngineInput, EngineContext, EngineResult } from "../core/engineTypes.ts";

export const reflectionEngineAdapter: Engine = {
  name: "reflection",
  async run(input: EngineInput, _ctx: EngineContext): Promise<EngineResult> {
    try {
      const startTime = Date.now();

      const reflectionInput: ReflectionInput = {
        trigger: input.payload?.trigger ?? "user_explicit",
        primaryOperator: input.payload?.primaryOperator ?? input.payload?.operator ?? "strategy",
        secondaryOperators: input.payload?.secondaryOperators ?? [],
        triggerMemory: input.payload?.triggerMemory,
        recentHistory: input.payload?.recentHistory,
        userPrompt: input.payload?.userPrompt,
      };

      const result = await reflectAndSave(reflectionInput);
      const latencyMs = Date.now() - startTime;

      return {
        status: "success",
        summary: result.summary || "Reflection completed",
        text: result.summary,
        data: {
          insights: result.insights,
          summary: result.summary,
          nextSteps: result.nextSteps,
          confidence: result.confidence,
          savedMemoryId: result.savedMemoryId,
        },
        logs: [],
        metrics: { latencyMs },
      };
    } catch (error: any) {
      return {
        status: "error",
        summary: error?.message ?? "Reflection failed",
        text: error?.message ?? String(error),
        data: {},
        logs: [error?.stack ?? ""],
        metrics: { latencyMs: 0 },
      };
    }
  },
};

// ═══════════════════════════════════════════════════════════════════
// LEGACY SHIM
// Old code may import `reflectOnOutcome`. Keep it working with the new flow.
// ═══════════════════════════════════════════════════════════════════

export async function reflectOnOutcome(
  history: any[],
  operator: string = "strategy"
): Promise<ReflectionOutput> {
  // Convert legacy `history` (array of {detail: string}) to FormattedMemory shape
  const recentHistory: FormattedMemory[] = history.map((h, i) => ({
    id: `legacy-${i}`,
    category: "context",
    value: typeof h === "string" ? h : (h?.detail ?? JSON.stringify(h)),
    createdAt: new Date(),
    primaryOperator: operator,
    relatedOperators: [],
  }));

  return reflect({
    trigger: "user_explicit",
    primaryOperator: operator,
    recentHistory,
  });
}