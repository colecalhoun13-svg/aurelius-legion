// aurelius/self/upgrades/coreEvolution.ts

export type OperatorCore = {
  name: string;
  insights: string[];
  lastUpdated?: string;
  // Allow richer core structure (domain, mission, principles, etc.)
  [key: string]: any;
};

export function evolveCore(
  core: OperatorCore,
  newInsights: string[]
): OperatorCore {
  if (!newInsights.length) return core;

  const existing = new Set(core.insights);
  const merged: string[] = [...core.insights];

  for (const insight of newInsights) {
    const trimmed = String(insight).trim();
    if (!trimmed) continue;
    if (existing.has(trimmed)) continue;
    existing.add(trimmed);
    merged.push(trimmed);
  }

  return {
    ...core,
    insights: merged,
    lastUpdated: new Date().toISOString(),
  };
}
