/**
 * autonomy/stateStore.ts
 * Aurelius OS v3.4 — JSON-backed autonomy state
 */

import fs from "fs";
import path from "path";
import { AutonomyState } from "./types";

const AUTONOMY_DIR = path.resolve(__dirname, "../data/autonomy");
const STATE_PATH = path.join(AUTONOMY_DIR, "state.json");

function ensureDir() {
  if (!fs.existsSync(AUTONOMY_DIR)) {
    fs.mkdirSync(AUTONOMY_DIR, { recursive: true });
  }
}

function defaultState(): AutonomyState {
  return {
    currentGoal: undefined,
    goals: [],
    history: []
  };
}

export function loadAutonomyState(): AutonomyState {
  ensureDir();
  if (!fs.existsSync(STATE_PATH)) {
    return defaultState();
  }
  try {
    const raw = fs.readFileSync(STATE_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    return {
      currentGoal: parsed.currentGoal,
      goals: parsed.goals ?? [],
      history: parsed.history ?? []
    };
  } catch {
    return defaultState();
  }
}

export function saveAutonomyState(state: AutonomyState): void {
  ensureDir();
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2), "utf-8");
}
