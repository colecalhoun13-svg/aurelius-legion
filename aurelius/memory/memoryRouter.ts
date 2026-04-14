// aurelius/memory/memoryRouter.ts
/**
 * Memory Router — Aurelius OS v3.4
 * Allows reading/writing memory via API routes.
 */

import { loadAllMemory } from "./memoryLoader.ts";
import { MemoryWriter } from "./memoryWriter.ts";

export const MemoryRouter = {
  getAll: () => loadAllMemory(),

  updateProfile: (data: any) => {
    const profile = {
      ...data,
      updatedAt: new Date().toISOString()
    };
    MemoryWriter.saveProfile(profile);
    return profile;
  },

  updateGoals: (data: any) => {
    const goals = {
      ...data,
      updatedAt: new Date().toISOString()
    };
    MemoryWriter.saveGoals(goals);
    return goals;
  },

  updatePreferences: (data: any) => {
    const prefs = {
      ...data,
      updatedAt: new Date().toISOString()
    };
    MemoryWriter.savePreferences(prefs);
    return prefs;
  },

  updateConstraints: (data: any) => {
    const constraints = {
      ...data,
      updatedAt: new Date().toISOString()
    };
    MemoryWriter.saveConstraints(constraints);
    return constraints;
  },

  appendHistory: (entry: string) => {
    const memory = loadAllMemory();
    const history = memory.history || {
      daily: [],
      weekly: [],
      research: [],
      tasks: [],
      updatedAt: ""
    };

    history.daily.push(entry);
    history.updatedAt = new Date().toISOString();

    MemoryWriter.saveHistory(history);
    return history;
  }
};
