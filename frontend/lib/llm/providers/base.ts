// ===============================================
// AURELIUS OS 3.4 — LLM BASE TYPES
// Shared types + provider interface.
// ===============================================

export type LLMRole = "system" | "user" | "assistant";

export interface LLMMessage {
  role: LLMRole;
  content: string;
}

export interface LLMRequest {
  model: string;
  messages: LLMMessage[];
  maxTokens?: number;
  temperature?: number;
}

export interface LLMResponse {
  content: string;
  raw?: unknown;
}

export interface LLMProviderConfig {
  apiKey: string;
  baseUrl?: string;
}

export interface LLMProvider {
  name: string;
  call(request: LLMRequest): Promise<LLMResponse>;
}
