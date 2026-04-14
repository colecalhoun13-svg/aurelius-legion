// aurelius/autonomy/dailyTaskSync.ts
/**
 * Daily Task Sync — Aurelius OS v3.4
 * Goal-aware, memory-aware.
 */

import { engineRouter } from "../core/engineRouter.ts";
import { loadAllMemory } from "../memory/memoryLoader.ts";

export async function syncDailyTasks(taskList: string): Promise<string> {
  const memory = loadAllMemory();

  const systemPrompt = `
You are the TASKS operator inside Aurelius OS v3.4.

Use memory context:
- Short-term goals: ${memory.goals?.shortTerm?.join(", ") || "None"}
- Constraints: ${memory.constraints?.time?.join(", ") || "None"}

Rules:
- Convert tasks into atomic steps
- Tie tasks to goals
- Remove vague tasks
- Ensure realism
`;

  return await engineRouter("tasks", systemPrompt, taskList);
}
