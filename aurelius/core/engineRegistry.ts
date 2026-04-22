/**
 * Aurelius OS v3.4 — Engine Registry
 */

import type { Engine } from "./engineTypes";

const engines = new Map<string, Engine>();

export function registerEngine(engine: Engine): void {
  if (!engine.name) throw new Error("Engine must have a name");
  engines.set(engine.name, engine);
}

export function getEngine(name: string): Engine | undefined {
  return engines.get(name);
}

export function listEngines(): Engine[] {
  return Array.from(engines.values());
}
