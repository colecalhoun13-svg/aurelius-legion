/**
 * memoryEngine.ts
 * Aurelius OS v3.4 — Persistent Memory Engine
 *
 * Handles long‑term memory storage and retrieval.
 * Uses JSON files under /data/memory for persistence.
 */

import fs from "fs";
import path from "path";

const MEMORY_DIR = path.join(process.cwd(), "data", "memory");

/* ---------------------------------------------------------
   READ MEMORY (Safe, ESM‑Ready)
--------------------------------------------------------- */

export async function readMemory(userId: string) {
  try {
    const filePath = path.join(MEMORY_DIR, `${userId}.json`);

    if (!fs.existsSync(filePath)) {
      return createEmptyMemory();
    }

    const raw = await fs.promises.readFile(filePath, "utf-8");
    return JSON.parse(raw);
  } catch (err) {
    console.error("Error reading memory:", err);
    return createEmptyMemory();
  }
}

/* ---------------------------------------------------------
   WRITE MEMORY (Safe Merge + Atomic Write)
--------------------------------------------------------- */

export async function writeMemory(userId: string, updates: any) {
  try {
    const filePath = path.join(MEMORY_DIR, `${userId}.json`);

    // Ensure directory exists
    await fs.promises.mkdir(MEMORY_DIR, { recursive: true });

    const existing = fs.existsSync(filePath)
      ? JSON.parse(await fs.promises.readFile(filePath, "utf-8"))
      : createEmptyMemory();

    const merged = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString()
    };

    // Atomic write: write to temp file then replace
    const tempPath = `${filePath}.tmp`;
    await fs.promises.writeFile(tempPath, JSON.stringify(merged, null, 2));
    await fs.promises.rename(tempPath, filePath);

    return merged;
  } catch (err) {
    console.error("Error writing memory:", err);
    return null;
  }
}

/* ---------------------------------------------------------
   EMPTY MEMORY TEMPLATE
--------------------------------------------------------- */

function createEmptyMemory() {
  const now = new Date().toISOString();

  return {
    identity: null,
    preferences: {},
    goals: [],
    tasks: [],
    training: [],
    business: [],
    calendar: [],
    knowledge: [],
    lastMessage: null,
    lastOperator: null,
    lastEngine: null,
    insights: [],
    createdAt: now,
    updatedAt: now
  };
}
