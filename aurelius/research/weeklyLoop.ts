// aurelius/research/weeklyLoop.ts
/**
 * Weekly Intelligence Loop — Aurelius OS v3.4
 * Uses:
 * - Cost-aware multi-engine research
 * - Memory layer
 * - Strategy / business / identity operators
 * - Snapshot-style output for logs + cockpit
 * - Optimization engine (NEW)
 * - Self-Upgrade engine (NEW)
 */

import { researchSweep } from "./researchSweep.ts";
import { loadAllMemory } from "../memory/memoryLoader.ts";
import { MemoryWriter } from "../memory/memoryWriter.ts";
import { engineRouter } from "../core/engineRouter.ts";
import { ResearchConfig } from "./researchConfig.ts";

// NEW: optimization engine
import { optimizeSystem } from "../analytics/optimizationEngine.ts";

// NEW: self-upgrade engine
import { upgradeAurelius } from "../self/upgradeRouter.ts";

export async function runWeeklyLoop(topic: string) {
  const memory = loadAllMemory();

  const systemContext = `
You are Aurelius OS v3.4 running the WEEKLY INTELLIGENCE LOOP.

User identity:
${memory.profile?.identity?.join(", ") || "Unknown"}

User goals:
Short-term: ${memory.goals?.shortTerm?.join(", ") || "None"}
Medium-term: ${memory.goals?.mediumTerm?.join(", ") || "None"}
Long-term: ${memory.goals?.longTerm?.join(", ") || "None"}

Constraints:
Time: ${memory.constraints?.time?.join(", ") || "None"}
Energy: ${memory.constraints?.energy?.join(", ") || "None"}
Schedule: ${memory.constraints?.schedule?.join(", ") || "None"}
Financial: ${memory.constraints?.financial?.join(", ") || "None"}
`.trim();

  // 1) Run cost-aware research sweep
  const research = await researchSweep(topic, {
    usePerplexity: ResearchConfig.weeklyUsesPerplexity,
    reason: "Weekly strategic sweep."
  });

  // 2) STRATEGY operator
  const strategyPrompt = `
You are the STRATEGY operator inside Aurelius OS v3.4.

Context:
${systemContext}

You are given a weekly research synthesis.

Your job:
- Identify the main bottlenecks
- Propose 3–5 strategic moves for the next 7 days
- Tie moves to user goals and constraints
- Keep it concrete and operator-ready
`;

  const strategyPlan = await engineRouter(
    "strategy",
    strategyPrompt,
    research
  );

  // 3) BUSINESS operator
  const businessPrompt = `
You are the BUSINESS operator inside Aurelius OS v3.4.

You are given:
- Weekly research synthesis
- Strategic moves

Your job:
- Turn this into an execution plan
- With offers, systems, and leverage in mind
- 3–7 clear actions for the week
`;

  const businessPlan = await engineRouter(
    "business",
    businessPrompt,
    `
RESEARCH:
${research}

STRATEGY PLAN:
${strategyPlan}
`
  );

  // 4) IDENTITY operator
  const identityPrompt = `
You are the IDENTITY operator inside Aurelius OS v3.4.

You are given:
- Weekly research synthesis
- Strategic plan
- Business execution plan

Your job:
- Align this with the user's identity
- Surface identity shifts
- Propose 1–3 identity-level commitments for the week
`;

  const identityAlignment = await engineRouter(
    "identity",
    identityPrompt,
    `
RESEARCH:
${research}

STRATEGY PLAN:
${strategyPlan}

BUSINESS PLAN:
${businessPlan}
`
  );

  // 5) Update system memory
  const now = new Date().toISOString();
  const system = {
    ...(memory.system || {
      lastDailyRun: null,
      lastWeeklyRun: null,
      operatorUsage: {},
      updatedAt: now
    }),
    lastWeeklyRun: now,
    updatedAt: now
  };

  MemoryWriter.saveSystem(system);

  const history = memory.history || {
    daily: [],
    weekly: [],
    research: [],
    tasks: [],
    updatedAt: now
  };

  history.weekly.push(
    `Weekly loop run at ${now} on topic: ${topic}`
  );
  history.research.push(research);
  history.updatedAt = now;

  MemoryWriter.saveHistory(history);

  // 6) Optimization engine (NEW)
  const optimization = optimizeSystem();

  // 7) Self-upgrade engine (NEW)
  const selfUpgrade = await upgradeAurelius();

  // 8) Build final weekly snapshot
  const snapshot = `
AURELIUS OS v3.4 — WEEKLY INTELLIGENCE SNAPSHOT
===============================================

TOPIC:
${topic}

RESEARCH SYNTHESIS:
${research}

STRATEGY PLAN:
${strategyPlan}

BUSINESS PLAN:
${businessPlan}

IDENTITY ALIGNMENT:
${identityAlignment}

OPTIMIZATION ENGINE OUTPUT:
${optimization}

SELF-UPGRADE ENGINE OUTPUT:
${selfUpgrade}

RUN AT:
${now}
`;

  return {
    topic,
    research,
    strategyPlan,
    businessPlan,
    identityAlignment,
    optimization,
    selfUpgrade,
    snapshot,
    usedPerplexity: ResearchConfig.weeklyUsesPerplexity
  };
}
