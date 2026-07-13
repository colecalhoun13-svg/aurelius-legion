// aurelius/missions/engine.ts
//
// MISSIONS — the autonomy loop that actually executes.
//
// Cole states an objective ("figure out X", "compile what we know about Y",
// "scan for Z"). Aurelius:
//   1. PLAN    — LLM decomposes the objective into 2-5 steps from a fixed
//                vocabulary (research | recall | synthesize). If the LLM is
//                unavailable or returns garbage, a deterministic fallback
//                plan runs instead — a mission never dies at the gate.
//   2. EXECUTE — steps run sequentially; each persists status + output so
//                progress is visible live on the Aurelius page.
//   3. REPORT  — final LLM report in the persona voice, then the report
//                auto-ingests into the corpus (the second brain grows from
//                its own missions) and a BridgeSignal surfaces it to Cole.
//
// Hard rules carried: research findings route through propose→confirm as
// always; missions never touch Living Knowledge directly, never act outward.

import { prisma } from "../core/db/prisma.ts";
import { runLLM } from "../llm/runLLM.ts";
import { runResearch } from "../research/researchEngine.ts";
import { semanticRecall } from "../retrieval/retrieve.ts";
import { ingestDocument } from "../corpus/ingest.ts";

const STEP_KINDS = new Set(["research", "recall", "synthesize"]);
const MAX_STEPS = 5;
const STEP_OUTPUT_CAP = 8000;

export type PlannedStep = { kind: "research" | "recall" | "synthesize"; input: string };

export async function createMission(input: {
  title?: string;
  objective: string;
  domain?: string;
  operatorName?: string;
  origin?: string;
  priority?: string;
}) {
  return prisma.mission.create({
    data: {
      title: input.title?.trim() || input.objective.slice(0, 80),
      objective: input.objective,
      domain: input.domain ?? "personal",
      operatorName: input.operatorName ?? "strategy",
      origin: input.origin ?? "cole",
      priority: input.priority ?? "normal",
    },
  });
}

// ── 1. PLAN ──────────────────────────────────────────────────────────

function fallbackPlan(objective: string): { steps: PlannedStep[]; summary: string } {
  return {
    summary: "Standard sweep: recall what the brain already holds, research the gap, synthesize.",
    steps: [
      { kind: "recall", input: objective },
      { kind: "research", input: objective },
      { kind: "synthesize", input: `Synthesize everything gathered into a direct answer to: ${objective}` },
    ],
  };
}

function parsePlan(text: string): { steps: PlannedStep[]; summary: string } | null {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed.steps)) return null;
    const steps: PlannedStep[] = parsed.steps
      .filter((s: any) => s && STEP_KINDS.has(s.kind) && typeof s.input === "string" && s.input.trim())
      .slice(0, MAX_STEPS)
      .map((s: any) => ({ kind: s.kind, input: s.input.trim() }));
    if (steps.length === 0) return null;
    // A mission without a synthesize step never produces a report — append one.
    if (!steps.some((s) => s.kind === "synthesize")) {
      steps.push({ kind: "synthesize", input: "Synthesize all prior step outputs into the final answer." });
    }
    return { steps, summary: typeof parsed.summary === "string" ? parsed.summary : "" };
  } catch {
    return null;
  }
}

export async function planMission(missionId: string) {
  const mission = await prisma.mission.findUniqueOrThrow({ where: { id: missionId } });

  let plan: { steps: PlannedStep[]; summary: string } | null = null;
  try {
    const response = await runLLM({
      taskType: "chat",
      operators: { primary: mission.operatorName ?? "strategy", secondaries: [] },
      input: `
Plan a background mission. Decompose the objective into 2-${MAX_STEPS} steps.
Allowed step kinds ONLY:
  - "recall"     — search the second brain (input: the search query)
  - "research"   — external research pass (input: the research query)
  - "synthesize" — compose from prior step outputs (input: the instruction)
End with exactly one synthesize step.

Respond with ONLY a JSON object, no prose:
{"summary": "<one line approach>", "steps": [{"kind": "...", "input": "..."}]}

OBJECTIVE: ${mission.objective}
DOMAIN: ${mission.domain}
`.trim(),
    });
    plan = parsePlan(response.text);
  } catch (err) {
    console.warn("[missions] LLM planning failed, using fallback:", err);
  }
  if (!plan) plan = fallbackPlan(mission.objective);

  await prisma.missionStep.deleteMany({ where: { missionId } });
  await prisma.missionStep.createMany({
    data: plan.steps.map((s, idx) => ({ missionId, idx, kind: s.kind, input: s.input })),
  });

  return prisma.mission.update({
    where: { id: missionId },
    data: { status: "planned", planSummary: plan.summary || null },
  });
}

// ── 2. EXECUTE ───────────────────────────────────────────────────────

async function executeStep(
  mission: { objective: string; domain: string; operatorName: string | null },
  step: { kind: string; input: string },
  priorOutputs: string[]
): Promise<string> {
  if (step.kind === "recall") {
    const hits = await semanticRecall({ query: step.input, limit: 8 });
    if (hits.length === 0) return "(nothing relevant in the second brain)";
    return hits
      .map((h) => `[${h.sourceType} · ${(h.similarity * 100).toFixed(0)}%] ${h.chunkText.slice(0, 500)}`)
      .join("\n\n");
  }

  if (step.kind === "research") {
    const r = await runResearch({
      query: step.input,
      operator: mission.operatorName ?? "strategy",
      depth: "medium",
    });
    const lines = [
      `SYNTHESIS: ${r.synthesis}`,
      ...r.insights.map((i) => `• ${i}`),
      r.proposalsCreated ? `(${r.proposalsCreated} knowledge proposals queued for review)` : "",
    ].filter(Boolean);
    return lines.join("\n");
  }

  // synthesize
  const context = priorOutputs.length
    ? priorOutputs.map((o, i) => `─── STEP ${i + 1} OUTPUT ───\n${o}`).join("\n\n")
    : "(no prior outputs)";
  const response = await runLLM({
    taskType: "chat",
    operators: { primary: mission.operatorName ?? "strategy", secondaries: [] },
    input: `
Background mission synthesis. Objective: ${mission.objective}

${context}

INSTRUCTION: ${step.input}
Write the result directly — tactical, grounded in the material above, no filler.
`.trim(),
  });
  // No engine = no synthesis. Fail honestly rather than filing (and
  // ingesting into the corpus) an error message dressed as a report.
  if (/is not configured|Missing .*_API_KEY|All configured LLM providers failed/i.test(response.text)) {
    throw new Error("no LLM engine available for synthesis");
  }
  return response.text;
}

export async function executeMission(missionId: string) {
  const mission = await prisma.mission.findUniqueOrThrow({
    where: { id: missionId },
    include: { steps: { orderBy: { idx: "asc" } } },
  });

  await prisma.mission.update({
    where: { id: missionId },
    data: { status: "running", startedAt: new Date() },
  });

  const outputs: string[] = [];
  for (const step of mission.steps) {
    await prisma.missionStep.update({
      where: { id: step.id },
      data: { status: "running", startedAt: new Date() },
    });
    try {
      const output = await executeStep(mission, step, outputs);
      outputs.push(output);
      await prisma.missionStep.update({
        where: { id: step.id },
        data: { status: "done", output: output.slice(0, STEP_OUTPUT_CAP), finishedAt: new Date() },
      });
    } catch (err: any) {
      const message = err?.message ?? String(err);
      await prisma.missionStep.update({
        where: { id: step.id },
        data: { status: "failed", error: message, finishedAt: new Date() },
      });
      // Recall/research failures don't kill the mission — synthesis works
      // with whatever landed. A failed synthesize step is fatal.
      if (step.kind === "synthesize") throw new Error(`synthesize step failed: ${message}`);
      outputs.push(`(step failed: ${message})`);
    }
  }

  return outputs;
}

// ── 3. REPORT ────────────────────────────────────────────────────────

export async function reportMission(missionId: string, outputs: string[]) {
  const mission = await prisma.mission.findUniqueOrThrow({ where: { id: missionId } });

  // The last synthesize output IS the report body.
  const report = outputs[outputs.length - 1] ?? "(mission produced no output)";

  // The brain grows from its own missions: the report joins the corpus,
  // which means all four auto-awareness writes fire for it too.
  let corpusDocId: string | null = null;
  try {
    const { doc } = await ingestDocument({
      title: `Mission report: ${mission.title}`,
      content: report,
      sourceType: "research",
      domain: mission.domain,
      operatorName: mission.operatorName ?? undefined,
      triggeredBy: mission.origin === "cole" ? "cole" : "self_directed",
    });
    corpusDocId = doc.id;
  } catch (err) {
    console.warn("[missions] report ingestion failed (mission still completes):", err);
  }

  await prisma.bridgeSignal.create({
    data: {
      kind: "background_result",
      domain: mission.domain,
      sourceType: "mission",
      sourceId: missionId,
      severity: "notice",
      title: `Mission complete: ${mission.title}`,
      body: report.slice(0, 1500),
    },
  });

  return prisma.mission.update({
    where: { id: missionId },
    data: { status: "completed", report, corpusDocId, finishedAt: new Date() },
  });
}

// ── Orchestrator ─────────────────────────────────────────────────────

export async function runMission(missionId: string) {
  try {
    await planMission(missionId);
    const outputs = await executeMission(missionId);
    return await reportMission(missionId, outputs);
  } catch (err: any) {
    const message = err?.message ?? String(err);
    console.error(`[missions] ${missionId} failed:`, message);
    await prisma.bridgeSignal.create({
      data: {
        kind: "background_result",
        domain: "personal",
        sourceType: "mission",
        sourceId: missionId,
        severity: "attention",
        title: "Mission failed",
        body: message.slice(0, 500),
      },
    });
    return prisma.mission.update({
      where: { id: missionId },
      data: { status: "failed", error: message, finishedAt: new Date() },
    });
  }
}

/** Create + run in the background. Returns the mission row immediately. */
export async function launchMission(input: Parameters<typeof createMission>[0]) {
  const mission = await createMission(input);
  runMission(mission.id).catch((err) => console.error("[missions] background run crashed:", err));
  return mission;
}

export async function listMissions(limit = 20) {
  return prisma.mission.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      steps: {
        orderBy: { idx: "asc" },
        select: { idx: true, kind: true, input: true, status: true, error: true },
      },
    },
  });
}

export async function getMission(id: string) {
  return prisma.mission.findUnique({
    where: { id },
    include: { steps: { orderBy: { idx: "asc" } } },
  });
}

export async function cancelMission(id: string) {
  // v1 soft-cancel: running steps finish, but the status flips so the UI
  // and any follow-on scheduling treat it as dead.
  return prisma.mission.update({
    where: { id },
    data: { status: "cancelled", finishedAt: new Date() },
  });
}
