// analytics/usageTracker.ts
/**
 * Usage Tracker — Aurelius OS v3.4
 * Tracks operator usage, engine usage, and topic frequency.
 */

import { loadAllMemory } from "../memory/memoryLoader.ts";
import { MemoryWriter } from "../memory/memoryWriter.ts";

export function trackOperatorUsage(operator: string) {
  const memory = loadAllMemory();
  const system = memory.system || {
    lastDailyRun: null,
    lastWeeklyRun: null,
    operatorUsage: {},
    updatedAt: new Date().toISOString()
  };

  system.operatorUsage[operator] =
    (system.operatorUsage[operator] || 0) + 1;

  system.updatedAt = new Date().toISOString();
  MemoryWriter.saveSystem(system);
}

export function trackEngineUsage(engine: string) {
  const memory = loadAllMemory();
  const system = memory.system || {
    lastDailyRun: null,
    lastWeeklyRun: null,
    operatorUsage: {},
    updatedAt: new Date().toISOString()
  };

  system.operatorUsage[`engine:${engine}`] =
    (system.operatorUsage[`engine:${engine}`] || 0) + 1;

  system.updatedAt = new Date().toISOString();
  MemoryWriter.saveSystem(system);
}

export function trackTopic(topic: string) {
  const memory = loadAllMemory();
  const history = memory.history || {
    daily: [],
    weekly: [],
    research: [],
    tasks: [],
    updatedAt: new Date().toISOString()
  };

  history.research.push(`Topic: ${topic}`);
  history.updatedAt = new Date().toISOString();

  MemoryWriter.saveHistory(history);
}
