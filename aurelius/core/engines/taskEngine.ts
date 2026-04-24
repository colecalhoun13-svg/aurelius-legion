// core/engines/taskEngine.ts
// Aurelius OS v3.4 — Task/Chat Engine (Operator-Aware + DB-backed)

import type {
  Engine,
  EngineInput,
  EngineContext,
  EngineResult
} from "../engineTypes.ts";
import { runDeepSeek } from "../../engines/deepseekEngine.ts";
import { getOperator } from "../operatorRegistry.ts";
import { createTask } from "../../repositories/taskRepository.ts";
import { getOperatorIdByName } from "../operatorHelpers.ts";

export const taskEngine: Engine = {
  name: "taskEngine",

  async run(input: EngineInput, ctx: EngineContext): Promise<EngineResult> {
    const { meta, message, systemPrompt } = input.payload || {};

    const operatorName: string =
      meta?.operatorName || ctx.operatorId || "strategy";

    const operatorProfile = getOperator(operatorName);

    const operatorPrompt = buildOperatorAugmentedPrompt(
      systemPrompt,
      operatorProfile
    );

    const text = await runDeepSeek({
      message,
      systemPrompt: operatorPrompt
    });

    const operatorId = await getOperatorIdByName(operatorProfile.name);

    await createTask({
      operatorId,
      title: `Task: ${message?.slice(0, 80) || "Unnamed task"}`,
      status: "completed",
      metadata: {
        systemPrompt,
        operatorName,
        responsePreview: text?.slice(0, 200),
      },
    });

    const summary = `Task engine completed chat response via DeepSeek with operator "${operatorProfile.name}" (${operatorProfile.domain}).`;

    return {
      status: "success",
      summary,
      data: {
        text,
        tokensUsed: null
      },
      logs: [summary],
      metrics: { latencyMs: 0 }
    };
  }
};

function buildOperatorAugmentedPrompt(
  baseSystemPrompt: string,
  operatorProfile: ReturnType<typeof getOperator>
): string {
  const lines: string[] = [];

  lines.push(baseSystemPrompt.trim());
  lines.push("");
  lines.push(
    `You are currently operating as the "${operatorProfile.name}" operator in the "${operatorProfile.domain}" domain.`
  );
  lines.push(`Mission: ${operatorProfile.mission}`);
  lines.push("");
  lines.push("Honor these principles while reasoning:");
  for (const p of operatorProfile.principles) {
    lines.push(`- ${p}`);
  }
  lines.push("");
  lines.push("Do NOT violate these constraints:");
  for (const c of operatorProfile.constraints) {
    lines.push(`- ${c}`);
  }
  lines.push("");
  lines.push("Prefer these heuristics when choosing actions or recommendations:");
  for (const h of operatorProfile.heuristics) {
    lines.push(`- ${h}`);
  }

  return lines.join("\n");
}
