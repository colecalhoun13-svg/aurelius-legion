// aurelius/training/reasoner.ts
//
// Training reasoning layer (Phase 4 Pass 2).
//
// Responsibilities:
//   1. Read recent sessions for an athlete (via Tool Engine)
//   2. Compute deterministic volume metrics (per-session, per-week, per-block)
//   3. Detect PRs (deterministic Brzycki + memory comparison)
//   4. Reason over the data via runLLM with the training operator
//   5. Return structured output for the caller to hand to write_feedback
//
// What this layer does NOT do:
//   - Doesn't write to sheets directly (caller does, via Tool Engine)
//   - Doesn't compute math (defers to volume.ts and prDetection.ts)
//   - Doesn't decide WHEN to fire (caller does)
//   - Doesn't write programs (architectural lock — never, period)
//
// Two entry points:
//   - reasonOverSession(client, dayTab, date) — γ flow: review one specific session
//   - reasonOverRecent(client, dayTab) — variant: review the most recent session

import { runLLM } from "../llm/runLLM.ts";
import { executeToolCall } from "../tools/toolEngine.ts";
import {
  computeSessionVolume,
  computeWeeklyVolumes,
  computeBlockVolume,
  groupSessionsByDate,
  type SessionRow,
  type SessionVolume,
  type WeeklyVolume,
  type BlockVolume,
} from "./volume.ts";
import {
  estimateSessionPRs,
  comparePRs,
  newPRsOnly,
  type PRComparison,
  type ExercisePREstimate,
} from "./prDetection.ts";
import { prisma } from "../core/db/prisma.ts";

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

export type TrainingFeedback = {
  client: string;
  date: string;
  dayTab: string;
  header: string;            // "Mike · Day 1"
  session: string;           // session paragraph
  volume: string;            // volume paragraph
  prs?: string;              // PR paragraph (omitted if no PRs)
  observation: string;       // closing observation paragraph
};

export type TrainingReasoningResult = {
  ok: boolean;
  feedback?: TrainingFeedback;
  newPRs: PRComparison[];
  metrics: {
    session: SessionVolume;
    weeks: WeeklyVolume[];
    block: BlockVolume;
  };
  rawSessionRows: SessionRow[];
  error?: string;
  llm?: {
    engine: string;
    model: string;
    tokensUsed: number;
    latencyMs: number;
  };
};

// ═══════════════════════════════════════════════════════════════════
// MAIN ENTRY: reason over a specific session
// ═══════════════════════════════════════════════════════════════════

export async function reasonOverSession(args: {
  client: string;
  sheetId: string;
  dayTab: string;
  targetDate: string;        // which session date to focus on
  blockTabs?: string[];      // for block-level context (default: just this tab)
}): Promise<TrainingReasoningResult> {
  const { client, sheetId, dayTab, targetDate } = args;
  const blockTabs = args.blockTabs ?? [dayTab];

  // ── Step 1: Pull session data ──
  const readResult = await executeToolCall({
    tool: "google_sheets",
    action: "read_block",
    data: { sheetId, dayTabs: blockTabs },
    operator: "training",
    context: { clientId: client },
  });

  if (!readResult.ok || !readResult.output) {
    return emptyResult(client, dayTab, targetDate, `read_block failed: ${readResult.error ?? "unknown"}`);
  }

  const allRows = (readResult.output.rows as SessionRow[]) ?? [];

  // Sessions for the TARGET date specifically (drives PR detection + session paragraph)
  const targetRows = allRows.filter((r) => r.date === targetDate);

  if (targetRows.length === 0) {
    return emptyResult(client, dayTab, targetDate, `no rows found for ${client} on ${targetDate}`);
  }

  // ── Step 2: Compute deterministic metrics ──
  const sessionVol = computeSessionVolume(targetRows);
  const weeks = computeWeeklyVolumes(allRows);
  const block = computeBlockVolume(allRows);

  // ── Step 3: PR detection ──
  const sessionPREstimates = estimateSessionPRs(targetRows);
  const knownPRs = await loadKnownPRs(client);
  const allComparisons = comparePRs(sessionPREstimates, knownPRs);
  const newPRs = newPRsOnly(allComparisons);

  // ── Step 4: LLM reasoning ──
  const reasoningInput = buildReasoningPrompt({
    client,
    dayTab,
    targetDate,
    sessionVol,
    weeks,
    block,
    sessionPREstimates,
    newPRs,
    targetRows,
  });

  let llmResponse;
  try {
    llmResponse = await runLLM({
      taskType: "reasoning",
      operators: { primary: "training", secondaries: [] },
      input: reasoningInput,
    });
  } catch (err: any) {
    // Strategic tier failure (Anthropic out of credits, etc.) → fall back to Groq.
    console.warn(`[reasoner] strategic tier failed (${err?.message ?? err}); falling back to groq`);
    try {
      llmResponse = await runLLM({
        taskType: "reasoning",
        operators: { primary: "training", secondaries: [] },
        input: reasoningInput,
        options: { engine: "groq" },
      });
    } catch (fallbackErr: any) {
      return {
        ok: false,
        error: `LLM reasoning failed (both strategic and groq fallback): ${fallbackErr?.message ?? String(fallbackErr)}`,
        newPRs,
        metrics: { session: sessionVol, weeks, block },
        rawSessionRows: targetRows,
      };
    }
  }

  // Some upstream errors return a "success" object with empty text and 0 tokens
  // (e.g. Anthropic credit error swallowed by the router). Detect and retry on Groq.
  if (!llmResponse.text || llmResponse.tokensUsed === 0) {
    console.warn(`[reasoner] strategic tier returned empty (tokens=${llmResponse.tokensUsed}); falling back to groq`);
    try {
      llmResponse = await runLLM({
        taskType: "reasoning",
        operators: { primary: "training", secondaries: [] },
        input: reasoningInput,
        options: { engine: "groq" },
      });
    } catch (fallbackErr: any) {
      return {
        ok: false,
        error: `LLM reasoning failed after empty-response retry: ${fallbackErr?.message ?? String(fallbackErr)}`,
        newPRs,
        metrics: { session: sessionVol, weeks, block },
        rawSessionRows: targetRows,
        llm: {
          engine: llmResponse.engine,
          model: llmResponse.model,
          tokensUsed: 0,
          latencyMs: llmResponse.latencyMs,
        },
      };
    }
  }

  // ── Step 5: Parse the structured output ──
  const feedback = parseReasoningOutput({
    rawText: llmResponse.text,
    client,
    date: targetDate,
    dayTab,
  });

  if (!feedback) {
    const errPrefix = !llmResponse.text || llmResponse.text.trim().length === 0
      ? "LLM returned empty response"
      : "LLM reasoning output could not be parsed into feedback structure";
    return {
      ok: false,
      error: `${errPrefix} (engine: ${llmResponse.engine}, model: ${llmResponse.model}, tokens: ${llmResponse.tokensUsed}, raw text length: ${llmResponse.text?.length ?? 0})`,
      newPRs,
      metrics: { session: sessionVol, weeks, block },
      rawSessionRows: targetRows,
      llm: {
        engine: llmResponse.engine,
        model: llmResponse.model,
        tokensUsed: llmResponse.tokensUsed,
        latencyMs: llmResponse.latencyMs,
      },
    };
  }

  return {
    ok: true,
    feedback,
    newPRs,
    metrics: { session: sessionVol, weeks, block },
    rawSessionRows: targetRows,
    llm: {
      engine: llmResponse.engine,
      model: llmResponse.model,
      tokensUsed: llmResponse.tokensUsed,
      latencyMs: llmResponse.latencyMs,
    },
  };
}

// ═══════════════════════════════════════════════════════════════════
// VARIANT: reason over the most recent session in a tab
// ═══════════════════════════════════════════════════════════════════

export async function reasonOverRecent(args: {
  client: string;
  sheetId: string;
  dayTab: string;
  blockTabs?: string[];
}): Promise<TrainingReasoningResult> {
  const { client, sheetId, dayTab, blockTabs } = args;

  // Find the latest date in this tab first
  const readResult = await executeToolCall({
    tool: "google_sheets",
    action: "read_sessions",
    data: { sheetId, dayTab, limit: 80 },
    operator: "training",
    context: { clientId: client },
  });

  if (!readResult.ok || !readResult.output) {
    return emptyResult(client, dayTab, "", `read_sessions failed: ${readResult.error ?? "unknown"}`);
  }

  const rows = (readResult.output.rows as SessionRow[]) ?? [];
  if (rows.length === 0) {
    return emptyResult(client, dayTab, "", `no sessions found in ${dayTab}`);
  }

  // Latest date wins
  const latestDate = rows.map((r) => r.date).filter((d) => !!d).sort().slice(-1)[0]!;

  return reasonOverSession({
    client,
    sheetId,
    dayTab,
    targetDate: latestDate,
    blockTabs,
  });
}

// ═══════════════════════════════════════════════════════════════════
// PROMPT CONSTRUCTION
// Enriches the LLM with computed metrics so reasoning is grounded.
// Asks for a structured response with named sections.
// ═══════════════════════════════════════════════════════════════════

function buildReasoningPrompt(args: {
  client: string;
  dayTab: string;
  targetDate: string;
  sessionVol: SessionVolume;
  weeks: WeeklyVolume[];
  block: BlockVolume;
  sessionPREstimates: Map<string, ExercisePREstimate>;
  newPRs: PRComparison[];
  targetRows: SessionRow[];
}): string {
  const {
    client,
    dayTab,
    targetDate,
    sessionVol,
    weeks,
    block,
    sessionPREstimates,
    newPRs,
    targetRows,
  } = args;

  // Find the week containing this session
  const targetWeek = weeks.find(
    (w) => targetDate >= w.weekStart && targetDate <= w.weekEnd
  );
  const previousWeek = targetWeek
    ? weeks[weeks.indexOf(targetWeek) - 1]
    : undefined;

  const wowDelta =
    targetWeek && previousWeek && previousWeek.totalTonnage > 0
      ? Math.round(
          ((targetWeek.totalTonnage - previousWeek.totalTonnage) /
            previousWeek.totalTonnage) *
            100
        )
      : null;

  const exerciseLines = sessionVol.exercises.map((e) => {
    const est = sessionPREstimates.get(e.exercise);
    const estStr = est && est.bestEstimated1RM > 0
      ? `est 1RM ~${est.bestEstimated1RM}`
      : "no 1RM (bodyweight or unparseable)";
    return `  - ${e.exercise}: ${e.workingSets} sets, ${e.totalReps} reps, ${e.tonnage} lb tonnage, peak ${e.highestLoad}, ${estStr}`;
  });

  const rawRowLines = targetRows.map((r) =>
    `  ${r.number}. ${r.exercise} — ${r.sets} sets × ${r.reps} reps @ ${r.load}${r.rpe ? ` (RPE ${r.rpe})` : ""}${r.notes ? ` (${r.notes})` : ""}`
  );

  const prLines = newPRs.length > 0
    ? newPRs.map((p) =>
        `  - ${p.exercise}: est ${p.newEstimate} lb (prior ${p.previousBest ?? "no record"}, +${p.improvement} lb / ${p.improvementPct}%)`
      )
    : ["  (no new PRs)"];

  const weeklyLines = weeks.slice(-4).map((w) =>
    `  ${w.weekStart} → ${w.weekEnd}: ${w.totalTonnage} lb, ${w.sessionCount} sessions, avg ${w.averagePerSession} lb/session`
  );

  return `
Cole has logged a session for ${client}. You are reasoning over the session as the training operator.

═══ SESSION CONTEXT ═══
Athlete: ${client}
Day tab: ${dayTab}
Date: ${targetDate}

═══ RAW SESSION DATA (what was actually logged) ═══
${rawRowLines.join("\n")}

═══ COMPUTED METRICS (deterministic) ═══

Session totals:
  Total tonnage: ${sessionVol.sessionTonnage} lb
  Working sets: ${sessionVol.totalWorkingSets}
  Unparseable rows: ${sessionVol.unparseable}

Per-exercise breakdown:
${exerciseLines.join("\n")}

Week-over-week:
  Current week: ${targetWeek ? `${targetWeek.totalTonnage} lb across ${targetWeek.sessionCount} session(s)` : "not computed"}
  Previous week: ${previousWeek ? `${previousWeek.totalTonnage} lb` : "no prior week data"}
  Delta: ${wowDelta !== null ? `${wowDelta > 0 ? "+" : ""}${wowDelta}%` : "n/a (insufficient history)"}

Block context (recent weeks, oldest first):
${weeklyLines.length > 0 ? weeklyLines.join("\n") : "  (no weekly data)"}

Block totals: ${block.totalTonnage} lb across ${block.totalSessions} sessions, ${block.blockStart} → ${block.blockEnd}

═══ NEW PRs DETECTED (Brzycki estimated 1RM vs prior known PRs) ═══
${prLines.join("\n")}

═══ YOUR TASK ═══
Write coaching feedback for Cole's eyes only. Athletes never see this.

Voice: journalistic-with-structure. Honest, observational, terse where possible. Reflect what the data shows; don't invent details. Reference real numbers from above. Don't repeat all the data — synthesize.

Hard rules:
- Never prescribe a future program or specific weights for the next session. Cole writes programs.
- High-level signals primarily. Tactical specifics only when warranted (e.g., a real fatigue flag).
- Don't moralize. Don't pad. Cole skims this.

Output format — return EXACTLY four labeled sections, each on its own block. Omit the PRs section if there are no new PRs:

[SESSION]
One short paragraph (2-3 sentences). What happened in this session. Refer to specific exercises if it helps.

[VOLUME]
One short paragraph (2-4 sentences). Tonnage, working sets, week-over-week trend, where this fits in the block. Concrete numbers welcome.

[PRS]
(Omit this section entirely if no new PRs.)
One short paragraph noting the PR(s) and what made them happen — the load and reps that produced the estimate. Don't oversell.

[OBSERVATION]
One short paragraph. The coaching signal worth flagging — fatigue, progression rate, RPE drift, anything that's worth Cole's attention before next session. If nothing's notable, say "Nothing notable." Don't fabricate concern.

Do not include ANY text outside the four labeled sections. No preamble, no closing remarks.
  `.trim();
}

// ═══════════════════════════════════════════════════════════════════
// PARSE LLM OUTPUT
// Pulls the four sections out by label.
// Tolerant to whitespace and bracket variations.
// ═══════════════════════════════════════════════════════════════════

function parseReasoningOutput(args: {
  rawText: string;
  client: string;
  date: string;
  dayTab: string;
}): TrainingFeedback | null {
  const { rawText, client, date, dayTab } = args;
  if (!rawText || typeof rawText !== "string") return null;

  const sections = extractSections(rawText);

  const session = sections.SESSION?.trim();
  if (!session) return null;

  const volume = (sections.VOLUME ?? "").trim();
  const prsRaw = (sections.PRS ?? "").trim();
  const observation = (sections.OBSERVATION ?? "").trim();

  // PRs section is optional; treat empty/whitespace/parenthetical-only as absent
  const prs = prsRaw && !/^\(.*\)$/.test(prsRaw) ? prsRaw : undefined;

  return {
    client,
    date,
    dayTab,
    header: `${client} · ${dayTab}`,
    session,
    volume: volume || "(volume metrics not provided)",
    prs,
    observation: observation || "Nothing notable.",
  };
}

function extractSections(text: string): Record<string, string> {
  // Match [LABEL] ... up to next [LABEL] or end
  const pattern = /\[(SESSION|VOLUME|PRS|OBSERVATION)\]([\s\S]*?)(?=\n\s*\[(?:SESSION|VOLUME|PRS|OBSERVATION)\]|$)/g;
  const result: Record<string, string> = {};
  let match;
  while ((match = pattern.exec(text)) !== null) {
    const label = match[1]!;
    const body = match[2] ?? "";
    result[label] = body.trim();
  }
  return result;
}

// ═══════════════════════════════════════════════════════════════════
// KNOWN PR LOOKUP
// Pulls prior PRs from memory metadata where the kind is "pr_record".
// Returns one record per exercise (the highest known estimate).
// ═══════════════════════════════════════════════════════════════════

async function loadKnownPRs(client: string): Promise<Array<{ exercise: string; estimated1RM: number; date: string; source: "memory" | "maxes_tab" | "computed" }>> {
  try {
    const memories = await prisma.memory.findMany({
      where: {
        operator: { name: "training" },
        metadata: {
          path: ["kind"],
          equals: "pr_record",
        },
      },
      orderBy: { createdAt: "desc" },
      take: 500,
    });

    // Filter to the right client + return parsed records
    const matched: Array<{ exercise: string; estimated1RM: number; date: string; source: "memory" }> = [];

    for (const m of memories) {
      const meta = m.metadata as any;
      const memClient = (meta?.client ?? "").toString().trim().toLowerCase();
      if (memClient !== client.toLowerCase()) continue;

      const exercise = (meta?.exercise ?? "").toString().trim();
      const estimated1RM = Number(meta?.estimated1RM);
      const date = (meta?.date ?? m.createdAt.toISOString().slice(0, 10)).toString();

      if (!exercise || !estimated1RM || isNaN(estimated1RM)) continue;

      matched.push({ exercise, estimated1RM, date, source: "memory" });
    }

    return matched;
  } catch (err) {
    console.error("[reasoner] loadKnownPRs failed:", err);
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════

function emptyResult(
  client: string,
  dayTab: string,
  date: string,
  errorMsg: string
): TrainingReasoningResult {
  return {
    ok: false,
    error: errorMsg,
    newPRs: [],
    metrics: {
      session: { date: "", sessionTonnage: 0, totalWorkingSets: 0, exercises: [], unparseable: 0 },
      weeks: [],
      block: { blockStart: "", blockEnd: "", totalTonnage: 0, totalSessions: 0, weeklyTonnage: [], weekOverWeekDeltas: [] },
    },
    rawSessionRows: [],
  };
}