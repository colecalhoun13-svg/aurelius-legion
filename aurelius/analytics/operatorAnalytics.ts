// aurelius/analytics/operatorAnalytics.ts

import { appendMemoryWrite } from "../memory/memoryWriter.ts";

export type OperatorUsageEvent = {
  engine: string;
  domain?: string;
  durationMs: number;
};

export async function trackOperatorUsage(
  operatorName: string,
  event: OperatorUsageEvent
): Promise<void> {
  const summary = [
    `Operator: ${operatorName}`,
    `Engine: ${event.engine}`,
    event.domain ? `Domain: ${event.domain}` : null,
    `Duration: ${event.durationMs}ms`,
  ]
    .filter(Boolean)
    .join(" | ");

  appendMemoryWrite({
    domain: "analytics",
    source: "operatorAnalytics",
    summary,
  });
}
