/**
 * planWeek.ts
 * Aurelius OS v3.4 — Weekly Plan Builder
 */

import type { OperatorType } from "../types.ts";
import type { GeneratedTask } from "./generateTasks.ts";

interface PlanWeekArgs {
  tasks: GeneratedTask[] | null;
  memory: any;
  operator: OperatorType;
}

export interface WeeklyDayPlan {
  date: string;
  tasks: GeneratedTask[];
}

export interface WeekPlan {
  weekStart: string;
  days: WeeklyDayPlan[];
  focusDomain: OperatorType;
}

export async function planWeek(
  args: PlanWeekArgs
): Promise<WeekPlan | null> {
  const { tasks, operator } = args;

  const list = tasks ?? [];
  if (list.length === 0) return null;

  const now = new Date();
  const weekStart = startOfWeekISO(now);

  const days: WeeklyDayPlan[] = [];

  for (let i = 0; i < 7; i++) {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + i);

    days.push({
      date: date.toISOString().slice(0, 10),
      tasks: []
    });
  }

  let dayIndex = 0;
  for (const task of list) {
    days[dayIndex].tasks.push(task);
    dayIndex = (dayIndex + 1) % days.length;
  }

  return {
    weekStart: weekStart.toISOString().slice(0, 10),
    days,
    focusDomain: operator
  };
}

function startOfWeekISO(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay() || 7;
  if (day !== 1) {
    d.setHours(-24 * (day - 1));
  }
  d.setHours(0, 0, 0, 0);
  return d;
}
