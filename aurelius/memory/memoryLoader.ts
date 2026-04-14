// aurelius/memory/memoryLoader.ts
/**
 * Loads all memory files into a single object.
 */

import {
  UserProfile,
  UserGoals,
  UserPreferences,
  UserConstraints,
  UserHistory,
  SystemMemory
} from "./memoryTypes.ts";

import { readMemoryFile } from "./memoryStore.ts";

export function loadAllMemory() {
  const profile = readMemoryFile<UserProfile>("user.profile.json");
  const goals = readMemoryFile<UserGoals>("user.goals.json");
  const preferences = readMemoryFile<UserPreferences>("user.preferences.json");
  const constraints = readMemoryFile<UserConstraints>("user.constraints.json");
  const history = readMemoryFile<UserHistory>("user.history.json");
  const system = readMemoryFile<SystemMemory>("system.memory.json");

  return {
    profile,
    goals,
    preferences,
    constraints,
    history,
    system
  };
}
