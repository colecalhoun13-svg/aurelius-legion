import { AutonomyContext, AutonomyEvent } from "./autonomyTypes";
import { decideNextAction } from "./decisionEngine";
import { planTask } from "./taskPlanner";
import { reflectOnOutcome } from "./reflectionEngine";
import { runResearch } from "../research/researchEngine";
import { runSelfUpgrade } from "../self/selfUpgradeEngine";

export async function runAutonomyLoop(
  ctx: AutonomyContext
): Promise<AutonomyEvent[]> {
  const events: AutonomyEvent[] = [...ctx.history];

  const decision = decideNextAction(ctx);

  events.push({
    type: "decision",
    timestamp: new Date().toISOString(),
    detail: `Action chosen: ${decision.action} — ${decision.reason}`,
  });

  if (decision.action === "research") {
    const research = await runResearch({
      query: ctx.goal,
      operator: ctx.operator,
      depth: "medium",
    });

    events.push({
      type: "task",
      timestamp: new Date().toISOString(),
      detail: `Research completed with ${research.length} insights.`,
    });
  }

  if (decision.action === "upgrade") {
    const upgrade = await runSelfUpgrade({
      operatorCores: [],
      researchTopics: [ctx.goal],
    });

    events.push({
      type: "task",
      timestamp: new Date().toISOString(),
      detail: `Self-upgrade added ${upgrade.researchInsights.length} insights.`,
    });
  }

  if (decision.action === "plan") {
    const plan = planTask(ctx.goal);

    events.push({
      type: "task",
      timestamp: new Date().toISOString(),
      detail: `Planned ${plan.steps.length} steps.`,
    });
  }

  if (decision.action === "reflect") {
    const reflection = reflectOnOutcome(events);

    events.push({
      type: "reflection",
      timestamp: new Date().toISOString(),
      detail: `Reflection generated ${reflection.insights.length} insights.`,
    });
  }

  return events;
}

// Export as Engine adapter
import type { Engine, EngineInput, EngineContext, EngineResult } from "../core/engineTypes";

export const autonomyEngineAdapter: Engine = {
  name: "autonomy",
  async run(input: EngineInput, ctx: EngineContext): Promise<EngineResult> {
    try {
      const startTime = Date.now();
      const events = await runAutonomyLoop({
        operator: input.payload?.operator || "strategy",
        autonomyMode: input.payload?.autonomyMode || "reactive",
        maxDepth: input.payload?.maxDepth || 3,
      });
      const latencyMs = Date.now() - startTime;

      return {
        status: "success",
        summary: "Autonomy loop completed",
        text: JSON.stringify(events),
        data: { events },
        logs: [],
        metrics: { latencyMs },
      };
    } catch (error: any) {
      return {
        status: "error",
        summary: error.message || "Autonomy failed",
        text: error.message,
        data: {},
        logs: [error.stack || ""],
        metrics: { latencyMs: 0 },
      };
    }
  },
};
