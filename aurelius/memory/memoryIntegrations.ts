// aurelius/memory/memoryIntegrations.ts
/**
 * Integrates memory into:
 * - engineRouter
 * - daily loop
 * - weekly loop
 * - operator selection
 */

import { loadAllMemory } from "./memoryLoader.ts";

export function injectMemoryContext(): string {
  const memory = loadAllMemory();

  return `
MEMORY CONTEXT:

User Identity:
${memory.profile?.identity?.join(", ") || "None"}

User Goals:
Short-term: ${memory.goals?.shortTerm?.join(", ") || "None"}
Medium-term: ${memory.goals?.mediumTerm?.join(", ") || "None"}
Long-term: ${memory.goals?.longTerm?.join(", ") || "None"}

Preferences:
${memory.preferences?.communicationStyle || "None"}

Constraints:
${memory.constraints?.time?.join(", ") || "None"}

Recent History:
${memory.history?.daily?.slice(-3).join("\n") || "None"}

System State:
Last daily run: ${memory.system?.lastDailyRun || "Never"}
Last weekly run: ${memory.system?.lastWeeklyRun || "Never"}
`.trim();
}
