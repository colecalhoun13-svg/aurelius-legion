/**
 * planDay.ts
 * Aurelius OS v3.4 — Daily Plan Builder
 */

import type { GeneratedTask } from "./generateTasks.ts";
import type { EnergyMap } from "./energyMatcher.ts";

interface PlanDayArgs {
  tasks: GeneratedTask[] | null;
  energyMap: EnergyMap | null;
  memory: any;
}

export interface DayPlanBlock {
  timeOfDay: "morning" | "afternoon" | "evening";
  tasks: GeneratedTask[];
}

export interface DayPlan {
  date: string;
  blocks: DayPlanBlock[];
}

export async function planDay(
  args: PlanDayArgs
): Promise<DayPlan | null> {
  const { tasks, energyMap } = args;

  const list = tasks ?? [];
  if (list.length === 0) return null;

  const map = energyMap ?? {
    morning: list,
    afternoon: [],
    evening: []
  };

  const today = new Date().toISOString().slice(0, 10);

  const blocks: DayPlanBlock[] = [
    {
      timeOfDay: "morning",
      tasks: map.morning.slice(0, 5)
    },
    {
      timeOfDay: "afternoon",
      tasks: map.afternoon.slice(0, 5)
    },
    {
      timeOfDay: "evening",
      tasks: map.evening.slice(0, 3)
    }
  ];

  const hasAny = blocks.some((b) => b.tasks.length > 0);
  if (!hasAny) return null;

  return {
    date: today,
    blocks
  };
}