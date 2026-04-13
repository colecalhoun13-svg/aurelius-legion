// ===============================================
// AURELIUS OS 3.4 — UNIFIED LLM INTERFACE
// Single entrypoint: runLLM()
// Supports: OpenAI, Anthropic, Groq, Grok, DeepSeek, Gemini
// ===============================================

import { LLMMessage, LLMRequest, LLMResponse } from "./providers/base";

import { openAIProvider } from "./providers/openai";
import { anthropicProvider } from "./providers/anthropic";
import { groqProvider } from "./providers/groq";
import { deepseekProvider } from "./providers/deepseek";
import { grokProvider } from "./providers/grok";
import { geminiProvider } from "./providers/gemini";

import { routeLLM, RoutingOptions } from "./router";
import { ProviderName } from "./modelRegistry";

const providerMap: Record<ProviderName, any> = {
  openai: openAIProvider,
  anthropic: anthropicProvider,
  groq: groqProvider,
  deepseek: deepseekProvider,
  grok: grokProvider,
  gemini: geminiProvider,
};

export interface RunLLMOptions extends RoutingOptions {
  maxTokens?: number;
  temperature?: number;
}

export async function runLLM(
  messages: LLMMessage[],
  options: RunLLMOptions = {}
): Promise<LLMResponse> {
  const decision = routeLLM(messages, options);
  const provider = providerMap[decision.model.provider];

  if (!provider) {
    throw new Error(`No provider implementation for: ${decision.model.provider}`);
  }

  const request: LLMRequest = {
    model: decision.model.id,
    messages,
    maxTokens: options.maxTokens ?? Math.min(decision.model.maxTokens, 2048),
    temperature: options.temperature,
  };

  return provider.call(request);
}
