/**
 * trainingCore.ts
 * Stores training, strength, conditioning intelligence.
 */

import fs from "fs";
import path, { dirname } from "path";
import { fileURLToPath } from "url";

// ESM-safe __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CORE_PATH = path.join(__dirname, "../../data/cores/training.json");

function ensureFile() {
  if (!fs.existsSync(CORE_PATH)) {
    fs.writeFileSync(
      CORE_PATH,
      JSON.stringify({ principles: [], insights: [] }, null, 2)
    );
  }
}

function loadCore() {
  ensureFile();
  return JSON.parse(fs.readFileSync(CORE_PATH, "utf8"));
}

function saveCore(data: any) {
  fs.writeFileSync(CORE_PATH, JSON.stringify(data, null, 2));
}

export function updateTrainingCore(research: any) {
  const core = loadCore();

  core.principles.push(...(research.principles || []));
  core.insights.push(...(research.insights || []));

  saveCore(core);
  console.log("Training core updated.");
}
