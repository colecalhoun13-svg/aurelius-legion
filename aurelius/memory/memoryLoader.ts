// aurelius/memory/memoryLoader.ts

import {
  FullMemory,
  UserProfile,
  UserGoals,
  UserConstraints,
  UserPreferences,
  UserHistory,
  SystemMemory,
} from "./memoryTypes";

import { readMemoryFile } from "./memoryStore";
import { getOperatorProfile } from "../core/operatorProfiles"; // adjust path if needed

function loadOrDefault<T>(filename: string, fallback: T): T {
  const data = readMemoryFile(filename);
  return (data as T) || fallback;
}

export function loadAllMemory(operator: string = "strategy"): FullMemory {
  const profile = getOperatorProfile(operator);
  const memoryPolicy = profile?.memoryPolicy;

  // --- 1) Load raw memory ----------------------------------------------------
  const rawProfile = loadOrDefault<UserProfile>("user.profile.json", {});
  const rawGoals = loadOrDefault<UserGoals>("user.goals.json", {});
  const rawConstraints = loadOrDefault<UserConstraints>("user.constraints.json", {});
  const rawPreferences = loadOrDefault<UserPreferences>("user.preferences.json", {});
  const rawHistory = loadOrDefault<UserHistory>("user.history.json", {});
  const rawSystem = loadOrDefault<SystemMemory>("system.memory.json", {
    insights: [],
    recentWrites: [],
  });

  // --- 2) Apply memory policy filters ----------------------------------------
  const filteredHistory = applyRetention(rawHistory, memoryPolicy);
  const filteredSystem = applySystemRetention(rawSystem, memoryPolicy);

  // --- 3) Apply compression style --------------------------------------------
  const compressedHistory = applyCompression(filteredHistory, memoryPolicy);
  const compressedSystem = applyCompression(filteredSystem, memoryPolicy);

  // --- 4) Return hydrated memory ---------------------------------------------
  return {
    profile: rawProfile,
    goals: rawGoals,
    constraints: rawConstraints,
    preferences: rawPreferences,
    history: compressedHistory,
    system: compressedSystem,
  };
}

// Alias for older imports
export function loadMemory(operator: string = "strategy"): FullMemory {
  return loadAllMemory(operator);
}

// --- Helpers -----------------------------------------------------------------

function applyRetention(history: UserHistory, policy: any): UserHistory {
  if (!policy) return history;

  const events = history.events || [];

  if (policy.retentionBias === "patterns") {
    return { events: events.filter((e) => e.length > 40) };
  }

  if (policy.retentionBias === "tactics") {
    return { events: events.filter((e) => e.length <= 80) };
  }

  if (policy.retentionBias === "decisions") {
    return {
      events: events.filter((e) =>
        /should|must|decide|choose|avoid|prefer/i.test(e)
      ),
    };
  }

  return history;
}

function applySystemRetention(system: SystemMemory, policy: any): SystemMemory {
  if (!policy) return system;

  const insights = system.insights || [];

  if (policy.retentionBias === "patterns") {
    return {
      ...system,
      insights: insights.filter((i) => i.length > 40),
    };
  }

  if (policy.retentionBias === "tactics") {
    return {
      ...system,
      insights: insights.filter((i) => i.length <= 80),
    };
  }

  if (policy.retentionBias === "decisions") {
    return {
      ...system,
      insights: insights.filter((i) =>
        /should|must|decide|choose|avoid|prefer/i.test(i)
      ),
    };
  }

  return system;
}

function applyCompression<T>(memory: T, policy: any): T {
  if (!policy) return memory;

  if (policy.compressionStyle === "high-signal") {
    return deepMap(memory, (text: string) => extractSignal(text));
  }

  if (policy.compressionStyle === "checklist") {
    return deepMap(memory, (text: string) => `• ${extractChecklist(text)}`);
  }

  if (policy.compressionStyle === "narrative") {
    return deepMap(memory, (text: string) => extractNarrative(text));
  }

  return memory;
}

// Recursively apply a transform to all string fields
function deepMap(obj: any, transform: (s: string) => string): any {
  if (typeof obj === "string") return transform(obj);
  if (Array.isArray(obj)) return obj.map((v) => deepMap(v, transform));
  if (typeof obj === "object" && obj !== null) {
    const out: any = {};
    for (const key of Object.keys(obj)) {
      out[key] = deepMap(obj[key], transform);
    }
    return out;
  }
  return obj;
}

function extractSignal(text: string): string {
  return text.split("—")[0].trim();
}

function extractChecklist(text: string): string {
  return text.replace(/Reflection:|Insight:/gi, "").trim();
}

function extractNarrative(text: string): string {
  return `This suggests that ${text.toLowerCase()}.`;
}
