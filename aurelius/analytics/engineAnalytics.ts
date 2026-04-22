// aurelius/analytics/engineAnalytics.ts

import { appendMemoryWrite } from "../memory/memoryWriter";

export type EngineUsageEvent = {
  operator?: string;
  domain?: string;
  durationMs: number;
  tokensUsed: number;
};

export async function trackEngineUsage(
  engineName: string,
  event: EngineUsageEvent
): Promise<void> {
  const summary = [
    `Engine: ${engineName}`,
    event.operator ? `Operator: ${event.operator}` : null,
    event.domain ? `Domain: ${event.domain}` : null,
    `Duration: ${event.durationMs}ms`,
    `Tokens: ${event.tokensUsed}`,
  ]
    .filter(Boolean)
    .join(" | ");

  appendMemoryWrite({
    domain: "analytics",
    source: "engineAnalytics",
    summary,
  });
}
