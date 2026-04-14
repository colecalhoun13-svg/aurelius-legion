// aurelius/memory/memoryWriter.ts
/**
 * Writes updates to memory files.
 */

import {
  UserProfile,
  UserGoals,
  UserPreferences,
  UserConstraints,
  UserHistory,
  SystemMemory
} from "./memoryTypes.ts";

import { writeMemoryFile } from "./memoryStore.ts";

export const MemoryWriter = {
  saveProfile: (data: UserProfile) =>
    writeMemoryFile("user.profile.json", data),

  saveGoals: (data: UserGoals) =>
    writeMemoryFile("user.goals.json", data),

  savePreferences: (data: UserPreferences) =>
    writeMemoryFile("user.preferences.json", data),

  saveConstraints: (data: UserConstraints) =>
    writeMemoryFile("user.constraints.json", data),

  saveHistory: (data: UserHistory) =>
    writeMemoryFile("user.history.json", data),

  saveSystem: (data: SystemMemory) =>
    writeMemoryFile("system.memory.json", data)
};
