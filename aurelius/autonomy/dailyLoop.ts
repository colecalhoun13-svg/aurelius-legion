// aurelius/autonomy/dailyLoop.ts
/**
 * Daily Autonomy Loop v2 — Aurelius OS v3.4
 * Memory-aware, cost-aware, identity-aware, cockpit-ready.
 */

import { generateDailyPlan } from "./dailyPlanning.ts";
import { generateDailyReflection } from "./dailyReflection.ts";
import { generateDailyResearch } from "./dailyResearch.ts";
import { syncDailyTasks } from "./dailyTaskSync.ts";
import { saveDailySnapshot } from "./dailySnapshot.ts";

import { loadAllMemory } from "../memory/memoryLoader.ts";
import { MemoryWriter } from "../memory/memoryWriter.ts";

export async function runDailyLoop(input: {
  plan: string;
  reflection: string;
  researchTopic: string;
  tasks: string;
}) {
  const memory = loadAllMemory();
  const now = new Date().toISOString();

  // 1) Run modules
  const dailyPlan = await generateDailyPlan(input.plan);
  const dailyReflection = await generateDailyReflection(input.reflection);
  const dailyResearch = await generateDailyResearch(input.researchTopic);
  const syncedTasks = await syncDailyTasks(input.tasks);

  // 2) Update memory
  const history = memory.history || {
    daily: [],
    weekly: [],
    research: [],
    tasks: [],
    updatedAt: now
  };

  history.daily.push(`Daily loop run at ${now}`);
  history.research.push(dailyResearch);
  history.tasks.push(syncedTasks);
  history.updatedAt = now;

  MemoryWriter.saveHistory(history);

  const system = {
    ...(memory.system || {
      lastDailyRun: null,
      lastWeeklyRun: null,
      operatorUsage: {},
      updatedAt: now
    }),
    lastDailyRun: now,
    updatedAt: now
  };

  MemoryWriter.saveSystem(system);

  // 3) Build snapshot
  const snapshot = `
AURELIUS OS v3.4 — DAILY SNAPSHOT
=================================

PLAN:
${dailyPlan}

REFLECTION:
${dailyReflection}

RESEARCH:
${dailyResearch}

TASK SYNC:
${syncedTasks}

RUN AT:
${now}
`;

  saveDailySnapshot(snapshot);

  return {
    dailyPlan,
    dailyReflection,
    dailyResearch,
    syncedTasks,
    snapshot
  };
}
