/**
 * energyMatcher.ts
 * Aurelius OS v3.4 — Match Tasks to Energy Windows
 */

import type { GeneratedTask } from "./generateTasks.ts";

interface EnergyMatcherArgs {
  tasks: GeneratedTask[] | null;
  memory: any;
}

export interface EnergyMap {
  morning: GeneratedTask[];
  afternoon: GeneratedTask[];
  evening: GeneratedTask[];
}

export async function energyMatcher(
  args: EnergyMatcherArgs
): Promise<EnergyMap | null> {
  const { tasks, memory } = args;

  const list = tasks ?? [];

  const chronotype = memory?.preferences?.chronotype ?? "neutral";

  const result: EnergyMap = {
    morning: [],
    afternoon: [],
    evening: []
  };

  for (const task of list) {
    const bucket = pickBucket(task, chronotype);
    result[bucket].push(task);
  }

  return result;
}

function pickBucket(
  task: GeneratedTask,
  chronotype: string
): keyof EnergyMap {
  const title = task.title.toLowerCase();

  const isDeepWork =
    title.includes("write") ||
    title.includes("plan") ||
    title.includes("strategy") ||
    title.includes("analyze");

  const isAdmin =
    title.includes("email") ||
    title.includes("inbox") ||
    title.includes("schedule") ||
    title.includes("call");

  if (chronotype === "morning") {
    if (isDeepWork) return "morning";
    if (isAdmin) return "afternoon";
    return "afternoon";
  }

  if (chronotype === "evening") {
    if (isDeepWork) return "evening";
    if (isAdmin) return "afternoon";
    return "afternoon";
  }

  if (isDeepWork) return "morning";
  if (isAdmin) return "afternoon";
  return "afternoon";
}
