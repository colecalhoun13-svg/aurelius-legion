// aurelius/autonomy/reflectionEngine.ts


import { Reflection } from "./autonomyTypes.ts";
import { getOperatorProfile } from "../core/operatorProfiles.ts"; // adjust path if needed
import { autonomyConfig } from "./autonomyConfig.ts";

export function reflectOnOutcome(history: any[], operator: string = "strategy"): Reflection {
  const profile = getOperatorProfile(operator);
  const decision = profile?.decisionProfile;
  const autonomy = profile?.autonomyPolicy;
  const memory = profile?.memoryPolicy;

  // --- 1) Determine reflection depth ----------------------------------------
  let depth = autonomy?.reflectionBias === "high" ? 6 : 3;
  const recent = history.slice(-depth);

  // --- 2) Generate insights based on memory style ----------------------------
  const insights: string[] = [];

  for (const event of recent) {
    const detail = event.detail ?? "";

    if (memory?.compressionStyle === "high-signal") {
      insights.push(`Insight: ${extractSignal(detail)}`);
    } else if (memory?.compressionStyle === "checklist") {
      insights.push(`• ${extractChecklist(detail)}`);
    } else if (memory?.compressionStyle === "narrative") {
      insights.push(`Story: ${extractNarrative(detail)}`);
    } else {
      insights.push(`Reflection: ${detail}`);
    }
  }

  // --- 3) Add operator-specific reflection behavior --------------------------
  if (operator === "strategy") {
    insights.push("Meta: Identify constraints, sequencing errors, and leverage points.");
  }

  if (operator === "athlete") {
    insights.push("Meta: Evaluate readiness, fatigue, and technique quality.");
  }

  if (operator === "business") {
    insights.push("Meta: Identify bottlenecks, system failures, and margin leaks.");
  }

  if (operator === "identity") {
    insights.push("Meta: Examine narratives, behaviors, and environmental alignment.");
  }

  // --- 4) Confidence score ---------------------------------------------------
  let confidence = 0.7;
  if (decision?.depthBias === "deep") confidence = 0.85;
  if (decision?.depthBias === "shallow") confidence = 0.55;

  return {
    insights,
    confidence,
  };
}

// --- Helper functions --------------------------------------------------------

function extractSignal(detail: string): string {
  // Pull out the most meaningful part of the detail
  return detail.split("—")[0].trim();
}

function extractChecklist(detail: string): string {
  // Convert detail into a short actionable item
  return detail.replace("Reflection:", "").trim();
}

function extractNarrative(detail: string): string {
  // Turn detail into a short story-like reflection
  return `From this event, we learned that ${detail.toLowerCase()}.`;
}

// Export as Engine adapter
import type { Engine, EngineInput, EngineContext, EngineResult } from "../core/engineTypes.ts";

export const reflectionEngineAdapter: Engine = {
  name: "reflection",
  async run(input: EngineInput, ctx: EngineContext): Promise<EngineResult> {
    try {
      const startTime = Date.now();
      const narrative = await runReflection({
        operator: input.payload?.operator || "strategy",
        detail: input.payload?.detail || "",
      });
      const latencyMs = Date.now() - startTime;

      return {
        status: "success",
        summary: "Reflection completed",
        text: narrative,
        data: { narrative },
        logs: [],
        metrics: { latencyMs },
      };
    } catch (error: any) {
      return {
        status: "error",
        summary: error.message || "Reflection failed",
        text: error.message,
        data: {},
        logs: [error.stack || ""],
        metrics: { latencyMs: 0 },
      };
    }
  },
};
