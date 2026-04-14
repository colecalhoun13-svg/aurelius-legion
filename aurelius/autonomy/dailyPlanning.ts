// aurelius/autonomy/dailyPlanning.ts
/**
 * Daily Planning Engine — Aurelius OS v3.4
 * Memory-aware, constraint-aware, identity-aware.
 */

import { engineRouter } from "../core/engineRouter.ts";
import { loadAllMemory } from "../memory/memoryLoader.ts";

export async function generateDailyPlan(message: string): Promise<string> {
  const memory = loadAllMemory();

  const systemPrompt = `
You are the DAILY PLANNING operator inside Aurelius OS v3.4.

Use memory context:
- Identity: ${memory.profile?.identity?.join(", ") || "None"}
- Short-term goals: ${memory.goals?.shortTerm?.join(", ") || "None"}
- Constraints: ${memory.constraints?.time?.join(", ") || "None"}
- Preferences: ${memory.preferences?.communicationStyle || "None"}

Rules:
- 1–3 non-negotiables
- realistic time blocks
- energy-aware planning
- constraint-aware scheduling
- buffers included
- avoid overstuffing the day
`;

  return await engineRouter("dailyPlanning", systemPrompt, message);
}
