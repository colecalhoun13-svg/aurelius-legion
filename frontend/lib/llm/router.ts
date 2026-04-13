// ===============================================
// AURELIUS OS 3.4 — LLM ROUTER
// Chooses model based on complexity + operator.
// Supports: OpenAI, Anthropic, Groq, Grok, DeepSeek, Gemini
// ===============================================

import { LLMMessage } from "./providers/base";
import { ModelDefinition, getModelById, modelRegistry } from "./modelRegistry";
import { ProviderName } from "./modelRegistry";

export interface RoutingOptions {
  operator?: string;
  forceProvider?: ProviderName;
  forceModelId?: string;
  preferSpeed?: boolean;
  preferDepth?: boolean;
}

export interface RoutingDecision {
  model: ModelDefinition;
}

function estimateComplexity(messages: LLMMessage[]): "low" | "medium" | "high" {
  const text = messages.map((m) => m.content).join(" ");
  const length = text.length;

  if (length < 400) return "low";
  if (length < 3000) return "medium";
  return "high";
}

export function routeLLM(
  messages: LLMMessage[],
  options: RoutingOptions = {}
): RoutingDecision {
  // -------------------------------
  // Forced model override
  // -------------------------------
  if (options.forceModelId) {
    const forced = getModelById(options.forceModelId);
    if (!forced) throw new Error(`Forced model not found: ${options.forceModelId}`);
    return { model: forced };
  }

  // -------------------------------
  // Forced provider override
  // -------------------------------
  if (options.forceProvider) {
    const candidate = modelRegistry.find((m) => m.provider === options.forceProvider);
    if (!candidate) throw new Error(`No model found for provider: ${options.forceProvider}`);
    return { model: candidate };
  }

  const complexity = estimateComplexity(messages);

  // -------------------------------
  // Operator-specific routing
  // -------------------------------
  if (options.operator === "coach") {
    if (complexity === "low") {
      return {
        model:
          modelRegistry.find((m) => m.provider === "groq") ||
          modelRegistry.find((m) => m.id === "gemini-1.5-flash")!,
      };
    }
    return {
      model:
        modelRegistry.find((m) => m.provider === "deepseek") ||
        modelRegistry.find((m) => m.id === "gemini-1.5-pro")!,
    };
  }

  if (options.operator === "business") {
    if (complexity === "high") {
      return {
        model:
          modelRegistry.find((m) => m.id === "claude-3-5-sonnet") ||
          modelRegistry.find((m) => m.id === "gemini-1.5-pro")!,
      };
    }
    return {
      model:
        modelRegistry.find((m) => m.provider === "openai") ||
        modelRegistry.find((m) => m.provider === "deepseek")!,
    };
  }

  // -------------------------------
  // Generic routing
  // -------------------------------
  if (complexity === "high") {
    return {
      model:
        modelRegistry.find((m) => m.id === "claude-3-5-sonnet") ||
        modelRegistry.find((m) => m.id === "gemini-1.5-pro")!,
    };
  }

  if (complexity === "medium") {
    return {
      model:
        modelRegistry.find((m) => m.provider === "openai") ||
        modelRegistry.find((m) => m.provider === "deepseek")!,
    };
  }

  return {
    model:
      modelRegistry.find((m) => m.provider === "groq") ||
      modelRegistry.find((m) => m.id === "gemini-1.5-flash")!,
  };
}
