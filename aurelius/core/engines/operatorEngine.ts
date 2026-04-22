/**
 * core/engines/operatorEngine.ts
 * Aurelius OS v3.4 — Operator Engine (Identity Layer)
 */

import type {
  Engine,
  EngineInput,
  EngineContext,
  EngineResult
} from "../engineTypes";
import { getOperator } from "../operatorRegistry";

export const operatorEngine: Engine = {
  name: "operatorEngine",

  async run(input: EngineInput, ctx: EngineContext): Promise<EngineResult> {
    const { operatorName, message, memory } = input.payload || {};

    const activeOperatorName: string =
      operatorName || ctx.operatorId || "strategy";

    const profile = getOperator(activeOperatorName);

    const promptSnippet = buildOperatorPromptSnippet(profile, {
      message,
      memory
    });

    const summary = `Operator "${profile.name}" (${profile.domain}) profile loaded.`;

    return {
      status: "success",
      summary,
      data: {
        operatorName: profile.name,
        domain: profile.domain,
        profile,
        promptSnippet,
        operatorMetadata: {
          tone: profile.tone,
          priorities: profile.priorities,
          constraints: profile.constraints,
          heuristics: profile.heuristics,
          mission: profile.mission
        }
      },
      logs: [summary],
      metrics: { latencyMs: 0 }
    };
  }
};

function buildOperatorPromptSnippet(
  profile: ReturnType<typeof getOperator>,
  context: { message?: string; memory?: any }
): string {
  const lines: string[] = [];

  lines.push(`You are operating as the "${profile.name}" operator.`);
  lines.push(`Domain: ${profile.domain}.`);
  lines.push(`Mission: ${profile.mission}`);

  if (profile.principles.length) {
    lines.push("");
    lines.push("Core principles:");
    for (const p of profile.principles) {
      lines.push(`- ${p}`);
    }
  }

  if (profile.constraints.length) {
    lines.push("");
    lines.push("Hard constraints (do not violate):");
    for (const c of profile.constraints) {
      lines.push(`- ${c}`);
    }
  }

  if (profile.heuristics.length) {
    lines.push("");
    lines.push("Heuristics to prefer in reasoning:");
    for (const h of profile.heuristics) {
      lines.push(`- ${h}`);
    }
  }

  if (profile.questions.length) {
    lines.push("");
    lines.push("Guiding questions to consider while reasoning:");
    for (const q of profile.questions) {
      lines.push(`- ${q}`);
    }
  }

  if (context.message) {
    lines.push("");
    lines.push("User message (for context):");
    lines.push(context.message);
  }

  return lines.join("\n");
}
