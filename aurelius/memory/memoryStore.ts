// aurelius/memory/memoryStore.ts

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MEMORY_DIR = path.resolve(
  __dirname,
  "../data/memory"
);

function ensureMemoryDir() {
  if (!fs.existsSync(MEMORY_DIR)) {
    fs.mkdirSync(MEMORY_DIR, { recursive: true });
  }
}

export function readMemoryFile(
  filename: string
): any | null {
  try {
    ensureMemoryDir();
    const filePath = path.join(MEMORY_DIR, filename);
    if (!fs.existsSync(filePath)) {
      return null;
    }
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw);
  } catch (err) {
    console.error(
      "[memoryStore] Failed to read memory file",
      filename,
      err
    );
    return null;
  }
}

export function writeMemoryFile(
  filename: string,
  data: any
): void {
  try {
    ensureMemoryDir();
    const filePath = path.join(MEMORY_DIR, filename);
    fs.writeFileSync(
      filePath,
      JSON.stringify(data, null, 2),
      "utf-8"
    );
  } catch (err) {
    console.error(
      "[memoryStore] Failed to write memory file",
      filename,
      err
    );
  }
}
