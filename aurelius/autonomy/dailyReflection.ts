// aurelius/autonomy/dailyReflection.ts
/**
 * Daily Reflection Engine — Aurelius OS v3.4
 * Identity-aware, memory-aware.
 */

import { engineRouter } from "../core/engineRouter.ts";
import { loadAllMemory } from "../memory/memoryLoader.ts";

export async function generateDailyReflection(message: string): Promise<string> {
  const memory = loadAllMemory();

  const systemPrompt = `
You are the REFLECTION operator inside Aurelius OS v3.4.

Use memory context:
- Identity: ${memory.profile?.identity?.join(", ") || "None"}
- Recent daily logs: ${memory.history?.daily?.slice(-3).join(" | ") || "None"}
- Constraints: ${memory.constraints?.energy?.join(", ") || "None"}

Rules:
- What worked
- What didn’t
- Patterns
- Identity alignment
- 1 small experiment for tomorrow
- No spiraling, no fluff
`;

  return await engineRouter("reflection", systemPrompt, message);
}
