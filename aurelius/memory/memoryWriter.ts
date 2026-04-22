// aurelius/memory/memoryWriter.ts

import { v4 as uuidv4 } from "uuid";
import {
  FullMemory,
  MemoryWrite,
  SystemMemory,
} from "./memoryTypes";

import { readMemoryFile, writeMemoryFile } from "./memoryStore";
import { getOperatorProfile } from "../core/operatorProfiles"; // adjust path if needed

const SYSTEM_MEMORY_FILE = "system.memory.json";
const MAX_RECENT_WRITES = 100;

function loadSystemMemory(): SystemMemory {
  const data = readMemoryFile(SYSTEM_MEMORY_FILE);
  if (!data) {
    return { insights: [], recentWrites: [] };
  }
  return data as SystemMemory;
}

// -----------------------------------------------------------------------------
// 1. Save full memory (unchanged — but now identity-aware upstream)
// -----------------------------------------------------------------------------
export function saveFullMemory(memory: FullMemory) {
  writeMemoryFile("user.profile.json", memory.profile);
  writeMemoryFile("user.goals.json", memory.goals);
  writeMemoryFile("user.constraints.json", memory.constraints);
  writeMemoryFile("user.preferences.json", memory.preferences);
  writeMemoryFile("user.history.json", memory.history);
  writeMemoryFile("system.memory.json", memory.system);
}

// -----------------------------------------------------------------------------
// 2. Identity-aware memory write
// -----------------------------------------------------------------------------
export function appendMemoryWrite(params: {
  domain: string;
  source: string;
  summary: string;
  operator?: string;
}) {
  const operator = params.operator ?? "strategy";
  const profile = getOperatorProfile(operator);
  const memoryPolicy = profile?.memoryPolicy;

  const system = loadSystemMemory();

  // --- 2.1 Apply compression style to summary --------------------------------
  const compressedSummary = applyCompression(params.summary, memoryPolicy);

  // --- 2.2 Apply retention rules (decisions, patterns, tactics) ---------------
  if (!passesRetention(compressedSummary, memoryPolicy)) {
    // If retention policy rejects the write, we still log it minimally
    return;
  }

  // --- 2.3 Create the memory write -------------------------------------------
  const write: MemoryWrite = {
    id: uuidv4(),
    timestamp: new Date().toISOString(),
    domain: params.domain,
    source: params.source,
    summary: compressedSummary,
  };

  // --- 2.4 Maintain recent writes --------------------------------------------
  const recentWrites = [write, ...(system.recentWrites || [])].slice(
    0,
    MAX_RECENT_WRITES
  );

  const updated: SystemMemory = {
    insights: system.insights || [],
    recentWrites,
  };

  writeMemoryFile(SYSTEM_MEMORY_FILE, updated);
}

// -----------------------------------------------------------------------------
// 3. Read recent writes
// -----------------------------------------------------------------------------
export function getRecentMemoryWrites(limit = 10): MemoryWrite[] {
  const system = loadSystemMemory();
  return (system.recentWrites || []).slice(0, limit);
}

// -----------------------------------------------------------------------------
// Helpers — retention + compression
// -----------------------------------------------------------------------------
function passesRetention(text: string, policy: any): boolean {
  if (!policy) return true;

  if (policy.retentionBias === "patterns") {
    return text.length > 40;
  }

  if (policy.retentionBias === "tactics") {
    return text.length <= 80;
  }

  if (policy.retentionBias === "decisions") {
    return /should|must|decide|choose|avoid|prefer/i.test(text);
  }

  return true;
}

function applyCompression(text: string, policy: any): string {
  if (!policy) return text;

  if (policy.compressionStyle === "high-signal") {
    return extractSignal(text);
  }

  if (policy.compressionStyle === "checklist") {
    return `• ${extractChecklist(text)}`;
  }

  if (policy.compressionStyle === "narrative") {
    return extractNarrative(text);
  }

  return text;
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
