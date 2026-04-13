// ===============================================
// AURELIUS OS 3.4 — MODEL REGISTRY
// Central list of all models + providers.
// Supports: OpenAI, Anthropic, Groq, Grok, DeepSeek, Gemini
// ===============================================

export type ProviderName =
  | "openai"
  | "anthropic"
  | "groq"
  | "deepseek"
  | "grok"
  | "gemini";

export interface ModelDefinition {
  id: string;
  provider: ProviderName;
  label: string;
  maxTokens: number;
  speed: "fast" | "balanced" | "deep";
  costTier: "low" | "medium" | "high";
  reasoning: "light" | "strong";
}

export const modelRegistry: ModelDefinition[] = [
  // -------------------------------
  // OPENAI
  // -------------------------------
  {
    id: "gpt-4.1-mini",
    provider: "openai",
    label: "OpenAI — GPT‑4.1 Mini",
    maxTokens: 16384,
    speed: "balanced",
    costTier: "low",
    reasoning: "strong",
  },
  {
    id: "gpt-4.1",
    provider: "openai",
    label: "OpenAI — GPT‑4.1",
    maxTokens: 32768,
    speed: "balanced",
    costTier: "high",
    reasoning: "strong",
  },

  // -------------------------------
  // ANTHROPIC
  // -------------------------------
  {
    id: "claude-3-5-sonnet",
    provider: "anthropic",
    label: "Claude 3.5 Sonnet",
    maxTokens: 200000,
    speed: "balanced",
    costTier: "high",
    reasoning: "strong",
  },

  // -------------------------------
  // GROQ
  // -------------------------------
  {
    id: "llama-3.1-70b-versatile",
    provider: "groq",
    label: "Groq — Llama 3.1 70B",
    maxTokens: 8192,
    speed: "fast",
    costTier: "low",
    reasoning: "light",
  },

  // -------------------------------
  // DEEPSEEK
  // -------------------------------
  {
    id: "deepseek-chat",
    provider: "deepseek",
    label: "DeepSeek — Chat",
    maxTokens: 8192,
    speed: "balanced",
    costTier: "low",
    reasoning: "strong",
  },

  // -------------------------------
  // GROK
  // -------------------------------
  {
    id: "grok-2",
    provider: "grok",
    label: "Grok — v2",
    maxTokens: 8192,
    speed: "fast",
    costTier: "medium",
    reasoning: "light",
  },

  // -------------------------------
  // GEMINI
  // -------------------------------
  {
    id: "gemini-1.5-pro",
    provider: "gemini",
    label: "Gemini 1.5 Pro",
    maxTokens: 1000000,
    speed: "balanced",
    costTier: "medium",
    reasoning: "strong",
  },
  {
    id: "gemini-1.5-flash",
    provider: "gemini",
    label: "Gemini 1.5 Flash",
    maxTokens: 8192,
    speed: "fast",
    costTier: "low",
    reasoning: "light",
  },
];

export function getModelById(id: string): ModelDefinition | undefined {
  return modelRegistry.find((m) => m.id === id);
}
