// aurelius/memory/memoryStore.ts
/**
 * Centralized memory store for Aurelius OS v3.4
 */

import fs from "fs";
import path from "path";

const MEMORY_DIR = path.resolve(process.cwd(), "data", "memory");

export function readMemoryFile<T>(fileName: string): T | null {
  try {
    const filePath = path.join(MEMORY_DIR, fileName);
    if (!fs.existsSync(filePath)) return null;

    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as T;
  } catch (err) {
    console.error(`Error reading memory file ${fileName}:`, err);
    return null;
  }
}

export function writeMemoryFile<T>(fileName: string, data: T) {
  try {
    const filePath = path.join(MEMORY_DIR, fileName);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.error(`Error writing memory file ${fileName}:`, err);
  }
}
