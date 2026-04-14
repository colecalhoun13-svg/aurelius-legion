// aurelius/self/selfUpgradeEngine.ts
/**
 * Self‑Upgrade Engine — Aurelius OS v3.4 → v3.5
 * Uses analytics + memory to evolve operator cores, identity, planning, and research depth.
 */

import { loadAllMemory } from "../memory/memoryLoader.ts";
import { evolveOperatorCores } from "./upgrades/coreEvolution.ts";
import { evolveIdentity } from "./upgrades/identityEvolution.ts";
import { evolvePlanning } from "./upgrades/planningEvolution.ts";
import { evolveResearchConfig } from "./upgrades/researchEvolution.ts";

export async function runSelfUpgrade(): Promise<string> {
  const memory = loadAllMemory();

  const coreUpgrade = evolveOperatorCores(memory);
  const identityUpgrade = evolveIdentity(memory);
  const planningUpgrade = evolvePlanning(memory);
  const researchUpgrade = evolveResearchConfig(memory);

  return `
AURELIUS OS — SELF‑UPGRADE REPORT
=================================

OPERATOR CORE EVOLUTION:
${coreUpgrade}

IDENTITY MODEL EVOLUTION:
${identityUpgrade}

PLANNING LOGIC EVOLUTION:
${planningUpgrade}

RESEARCH DEPTH EVOLUTION:
${researchUpgrade}
`.trim();
}
