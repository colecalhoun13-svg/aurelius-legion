/**
 * aurelius/index.ts
 * Aurelius OS — Unified Server Entry Point
 */
import dotenv from "dotenv";
dotenv.config({ path: "./.env" });

import express, { type Request, type Response } from "express";
import cors from "cors";

// Canonical engine routing (legacy, kept for other endpoints)
import { routeTask } from "./core/engineRouter.ts";
// Multi-operator routing
import { routeOperators } from "./router/operatorRouter.ts";
// Smart LLM routing
import { runLLM } from "./llm/runLLM.ts";
// Memory service (multi-operator aware)
import {
  saveMemory,
  loadMemoriesForOperator,
  findClientSheetId,
} from "./memory/memoryService.ts";
// Centralized directive parser ([SAVE:] and [TOOL:])
import { extractDirectives, type ToolDirective } from "./llm/directiveParser.ts";
// Reflection
import { reflectAndSave } from "./autonomy/reflectionEngine.ts";
// Research
import { runResearch } from "./research/researchEngine.ts";
// Tool engine
import { executeToolCall } from "./tools/toolEngine.ts";
import type { ToolResult } from "./tools/types.ts";
// Training reasoning (Phase 4)
import {
  reasonOverSession,
  type TrainingReasoningResult,
} from "./training/reasoner.ts";
// Register all engines once
import { registerAllEngines } from "./core/registerEngines.ts";
registerAllEngines();

// Register all tools once
import { registerAllTools } from "./tools/registerTools.ts";
registerAllTools();

// Routers
import { engineTestRouter } from "./router/index.ts";
import { autonomyRouter } from "./router/autonomyRouter.ts";

const app = express();
app.use(express.json());
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true,
  })
);

console.log("ENV CHECK — Aurelius OS");
console.log("OPENAI_API_KEY:", !!process.env.OPENAI_API_KEY);
console.log("ANTHROPIC_API_KEY:", !!process.env.ANTHROPIC_API_KEY);
console.log("GROQ_API_KEY:", !!process.env.GROQ_API_KEY);
console.log("GEMINI_API_KEY:", !!process.env.GEMINI_API_KEY);
console.log("DEEPSEEK_API_KEY:", !!process.env.DEEPSEEK_API_KEY);
console.log("XAI_API_KEY:", !!process.env.XAI_API_KEY);
console.log("DATABASE_URL:", !!process.env.DATABASE_URL);
console.log("===================================================");

app.use("/api", engineTestRouter);
app.use("/api/autonomy", autonomyRouter);

app.get("/", (req: Request, res: Response) => {
  res.send("Aurelius OS backend is running");
});

// ═══════════════════════════════════════════════════════════════════
// Reflection auto-fire trigger
// Categories that warrant automatic reflection after a memory write.
// ═══════════════════════════════════════════════════════════════════

const REFLECTION_CATEGORIES = new Set(["decisions", "events", "clients"]);

/**
 * Fire reflection in the background for a freshly-saved memory.
 * Errors are swallowed so they never break the user response.
 */
function fireBackgroundReflection(args: {
  primary: string;
  secondaries: string[];
  category: string;
  value: string;
}) {
  // Don't await — runs after the response has been sent.
  reflectAndSave({
    trigger: "memory_write",
    primaryOperator: args.primary,
    secondaryOperators: args.secondaries,
    triggerMemory: { category: args.category, value: args.value },
  }).catch((err) => {
    console.error("[aurelius] background reflection failed:", err);
  });
}

// ═══════════════════════════════════════════════════════════════════
// Tool directive resolution + execution
// Resolves data shortcuts (e.g., `client: "Mike"` → real sheetId from memory)
// then executes via Tool Engine. Returns a result Aurelius can fold into
// the final response to Cole.
// ═══════════════════════════════════════════════════════════════════

type ExecutedTool = {
  directive: ToolDirective;
  result: ToolResult;
  resolvedClientId?: string;
};

async function executeToolDirectives(
  directives: ToolDirective[],
  primaryOperator: string
): Promise<ExecutedTool[]> {
  const executed: ExecutedTool[] = [];

  for (const directive of directives) {
    let resolvedClientId: string | undefined;
    let data = { ...directive.data };

    // If the directive references a `client` name and lacks a `sheetId`,
    // try to resolve the sheet ID from memory.
    if (data.client && !data.sheetId) {
      const sheetId = await findClientSheetId(data.client);
      if (sheetId) {
        data.sheetId = sheetId;
        resolvedClientId = data.client;
      } else {
        executed.push({
          directive,
          result: {
            ok: false,
            output: null,
            error: `No registered sheet for client "${data.client}". Use POST /api/aurelius/register-sheet to register one first.`,
            durationMs: 0,
          },
        });
        continue;
      }
    }

    console.log(`[tool-call] ${directive.tool}.${directive.action} —`, JSON.stringify(data, null, 2));

    const result = await executeToolCall({
      tool: directive.tool,
      action: directive.action,
      data,
      operator: primaryOperator,
      context: resolvedClientId ? { clientId: resolvedClientId } : undefined,
    });

    if (!result.ok) {
      console.warn(`[tool-call] FAILED — ${result.error}`);
    }

    executed.push({ directive, result, resolvedClientId });
  }

  return executed;
}

function summarizeToolResults(executed: ExecutedTool[]): string {
  if (executed.length === 0) return "";

  const lines: string[] = ["", "─── Tool results ───"];
  for (const ex of executed) {
    const head = `${ex.directive.tool}.${ex.directive.action}`;
    if (!ex.result.ok) {
      lines.push(`✗ ${head}: ${ex.result.error ?? "failed"}`);
      continue;
    }

    const summary = ex.result.output?.summary ?? "completed";
    lines.push(`✓ ${head}: ${summary}`);

    // For read actions, include the actual data rows so Cole sees ground truth
    // alongside whatever the LLM said. Prevents hallucination from being silent.
    const output = ex.result.output;
    if (output) {
      // read_sessions returns a rows array of session objects
      if (Array.isArray(output.rows) && ex.directive.action === "read_sessions") {
        for (const row of output.rows as any[]) {
          const parts = [
            row.date,
            `#${row.number}`,
            row.exercise,
            row.sets ? `${row.sets} sets` : "",
            row.reps ? `${row.reps} reps` : "",
            row.load ? `@ ${row.load}` : "",
            row.rpe ? `RPE ${row.rpe}` : "",
            row.notes ? `(${row.notes})` : "",
          ].filter(Boolean);
          lines.push(`   ${parts.join(" · ")}`);
        }
      }

      // read_dashboard returns a rows array of [string][] (raw cell values)
      if (Array.isArray(output.rows) && ex.directive.action === "read_dashboard") {
        const dashRows = output.rows as any[][];
        // Treat consecutive rows as label/value pairs where possible
        for (let i = 0; i < dashRows.length; i += 2) {
          const label = (dashRows[i]?.[0] ?? "").toString().trim();
          const value = (dashRows[i + 1]?.[0] ?? "").toString().trim();
          if (label || value) {
            lines.push(`   ${label}: ${value}`);
          }
        }
      }

      // list_athletes returns an athletes array
      if (Array.isArray(output.athletes) && ex.directive.action === "list_athletes") {
        if (output.athletes.length === 0) {
          lines.push(`   (no athletes registered yet — use POST /api/aurelius/register-sheet)`);
        } else {
          for (const a of output.athletes as any[]) {
            const parts = [
              a.name,
              a.sport ? a.sport : "",
              a.position ? a.position : "",
            ].filter(Boolean);
            lines.push(`   • ${parts.join(" · ")}`);
          }
        }
      }

      // review_recent returns a sessionsToReview array (Phase 4 δ flow)
      if (Array.isArray(output.sessionsToReview) && ex.directive.action === "review_recent") {
        if (output.sessionsToReview.length === 0) {
          lines.push(`   (no sessions in the lookback window meet the threshold)`);
        } else {
          for (const s of output.sessionsToReview as any[]) {
            lines.push(`   • ${s.date} · ${s.client} · ${s.dayTab} · ${s.exerciseCount} exercises · ${s.workingSetCount} working sets`);
          }
        }
      }
    }
  }
  return lines.join("\n");
}

// ═══════════════════════════════════════════════════════════════════
// PHASE 4 — Two-pass training reasoning
// After successful log_session OR review_recent, fire reasoning for each
// eligible session. Reasoning produces feedback + PRs which are then
// written back to the athlete's sheet via the Tool Engine.
// ═══════════════════════════════════════════════════════════════════

type Pass2Outcome = {
  client: string;
  dayTab: string;
  date: string;
  ok: boolean;
  feedbackWritten?: boolean;
  prsRecorded?: number;
  error?: string;
  llmTokens?: number;
};

/**
 * For each successful log_session in this turn, run reasoning and write
 * feedback + maxes back to the sheet. Returns one outcome per attempted
 * session so we can surface successes and failures to Cole.
 */
async function firePass2ForLoggedSessions(
  executed: ExecutedTool[]
): Promise<Pass2Outcome[]> {
  const outcomes: Pass2Outcome[] = [];

  for (const ex of executed) {
    if (!ex.result.ok) continue;
    if (ex.directive.tool !== "google_sheets") continue;
    if (ex.directive.action !== "log_session") continue;

    const data = ex.directive.data as any;
    const sheetId = ex.result.output?.sheetId as string | undefined;
    const dayTab = (data?.dayTab ?? ex.result.output?.dayTab) as string | undefined;
    const date = (data?.date ?? ex.result.output?.date) as string | undefined;
    const client = (ex.resolvedClientId ?? data?.client) as string | undefined;

    if (!sheetId || !dayTab || !date || !client) {
      outcomes.push({
        client: client ?? "(unknown)",
        dayTab: dayTab ?? "(unknown)",
        date: date ?? "(unknown)",
        ok: false,
        error: "missing context for Pass 2 (sheetId/dayTab/date/client)",
      });
      continue;
    }

    const outcome = await runPass2(client, sheetId, dayTab, date);
    outcomes.push(outcome);
  }

  return outcomes;
}

/**
 * For each session surfaced by review_recent, run reasoning + feedback.
 * Same outcome shape as the log_session-triggered path.
 */
async function firePass2ForReviewRecent(
  executed: ExecutedTool[]
): Promise<Pass2Outcome[]> {
  const outcomes: Pass2Outcome[] = [];

  for (const ex of executed) {
    if (!ex.result.ok) continue;
    if (ex.directive.tool !== "google_sheets") continue;
    if (ex.directive.action !== "review_recent") continue;

    const sessions = (ex.result.output?.sessionsToReview as any[]) ?? [];
    for (const s of sessions) {
      const outcome = await runPass2(s.client, s.sheetId, s.dayTab, s.date);
      outcomes.push(outcome);
    }
  }

  return outcomes;
}

/**
 * Single Pass 2 execution: read → reason → write feedback + maxes.
 */
async function runPass2(
  client: string,
  sheetId: string,
  dayTab: string,
  date: string
): Promise<Pass2Outcome> {
  console.log(`[pass-2] firing reasoning for ${client} · ${dayTab} · ${date}`);

  let reasoning: TrainingReasoningResult;
  try {
    reasoning = await reasonOverSession({
      client,
      sheetId,
      dayTab,
      targetDate: date,
    });
  } catch (err: any) {
    return {
      client,
      dayTab,
      date,
      ok: false,
      error: `reasonOverSession threw: ${err?.message ?? String(err)}`,
    };
  }

  if (!reasoning.ok || !reasoning.feedback) {
    return {
      client,
      dayTab,
      date,
      ok: false,
      error: reasoning.error ?? "reasoning produced no feedback",
      llmTokens: reasoning.llm?.tokensUsed,
    };
  }

  // Write the feedback block to Tab 4
  const feedback = reasoning.feedback;
  const writeResult = await executeToolCall({
    tool: "google_sheets",
    action: "write_feedback",
    data: {
      sheetId,
      client,
      date: feedback.date,
      header: feedback.header,
      session: feedback.session,
      volume: feedback.volume,
      prs: feedback.prs,
      observation: feedback.observation,
    },
    operator: "training",
    context: { clientId: client },
  });

  // Best-effort: write each new PR to the Maxes tab. Don't fail Pass 2 if Maxes write fails.
  let prsRecorded = 0;
  for (const pr of reasoning.newPRs) {
    if (pr.previousBest === null) continue; // skip first-ever exercise (baseline, not a "PR" Cole tracks)
    try {
      const maxResult = await executeToolCall({
        tool: "google_sheets",
        action: "update_max",
        data: {
          sheetId,
          exercise: pr.exercise,
          estimated1RM: pr.newEstimate,
          fromLoad: 0, // not surfaced by comparePRs; ok to leave 0 for now
          fromReps: 0,
          date,
          previousBest: pr.previousBest,
          improvementPct: pr.improvementPct,
        },
        operator: "training",
        context: { clientId: client },
      });
      if (maxResult.ok) prsRecorded++;
    } catch (err) {
      console.error(`[pass-2] Maxes update failed for ${pr.exercise}:`, err);
    }
  }

  // Persist PR records to memory so future reasoning has them as known PRs
  for (const pr of reasoning.newPRs) {
    try {
      await saveMemory({
        operator: "training",
        category: "facts",
        value: `${client} hit a PR — ${pr.exercise}: est 1RM ${pr.newEstimate} lb (prior ${pr.previousBest ?? "no prior"})`,
        relatedOperators: [],
        metadata: {
          kind: "pr_record",
          client,
          exercise: pr.exercise,
          estimated1RM: pr.newEstimate,
          previousBest: pr.previousBest,
          improvementPct: pr.improvementPct,
          date,
        },
      });
    } catch (err) {
      console.error(`[pass-2] PR memory save failed for ${pr.exercise}:`, err);
    }
  }

  return {
    client,
    dayTab,
    date,
    ok: writeResult.ok,
    feedbackWritten: writeResult.ok,
    prsRecorded,
    error: writeResult.ok ? undefined : writeResult.error,
    llmTokens: reasoning.llm?.tokensUsed,
  };
}

function summarizePass2(outcomes: Pass2Outcome[]): string {
  if (outcomes.length === 0) return "";

  const lines: string[] = ["", "─── Aurelius reasoning ───"];
  for (const o of outcomes) {
    const head = `${o.client} · ${o.dayTab} · ${o.date}`;
    if (o.ok) {
      const prsPart = o.prsRecorded ? ` · ${o.prsRecorded} PR${o.prsRecorded === 1 ? "" : "s"} recorded` : "";
      lines.push(`✓ ${head}: feedback written${prsPart}`);
    } else {
      lines.push(`✗ ${head}: ${o.error ?? "failed"}`);
    }
  }
  return lines.join("\n");
}

// ═══════════════════════════════════════════════════════════════════
// Main Aurelius chat endpoint
// ═══════════════════════════════════════════════════════════════════

app.post("/api/aurelius", async (req: Request, res: Response) => {
  const {
    message,
    options,
    taskType,
    urgency,
    autonomyMode,
    needsRealtime,
    hasMultimodal,
    save: explicitSave,
  } = req.body;

  if (!message || typeof message !== "string") {
    return res.status(400).json({ error: "Message is required" });
  }

  try {
    // Multi-operator routing
    const routing = routeOperators(message);
    const { primary, secondaries } = routing;

    // ── Trigger 3: user-explicit reflection ──
    // taskType: "reflect" routes through reflection-specific flow.
    if (taskType === "reflect") {
      const recentHistory = await loadMemoriesForOperator({
        operator: primary,
        userMessage: message,
      });

      const reflection = await reflectAndSave({
        trigger: "user_explicit",
        primaryOperator: primary,
        secondaryOperators: secondaries,
        recentHistory: recentHistory.slice(0, 15),
        userPrompt: message,
      });

      return res.json({
        reply: reflection.summary,
        operators: { primary, secondaries },
        reflection: {
          summary: reflection.summary,
          insights: reflection.insights,
          nextSteps: reflection.nextSteps ?? [],
          confidence: reflection.confidence,
          savedMemoryId: reflection.savedMemoryId,
        },
        meta: {
          mode: "reflection",
          memoriesSaved: { explicit: 0, auto: 0, reflection: 1 },
        },
        reviewed: null,
      });
    }

    // ── Pattern 1: explicit save BEFORE running LLM ──
    const savedExplicit: any[] = [];
    let explicitSavedCategory: string | null = null;
    let explicitSavedValue: string | null = null;
    if (explicitSave && typeof explicitSave === "object") {
      try {
        const result = await saveMemory({
          operator: explicitSave.operator || primary,
          category: explicitSave.category || "facts",
          value: explicitSave.value,
          relatedOperators: explicitSave.relatedOperators ?? secondaries,
          metadata: explicitSave.metadata,
        });
        if (result) {
          savedExplicit.push(result);
          explicitSavedCategory = explicitSave.category || "facts";
          explicitSavedValue = explicitSave.value;
        }
      } catch (err) {
        console.error("[aurelius] explicit save failed:", err);
      }
    }

    // ── Run LLM through smart router ──
    const response = await runLLM({
      taskType: taskType || "chat",
      operators: { primary, secondaries },
      autonomyMode,
      urgency,
      input: message,
      options,
      needsRealtime,
      hasMultimodal,
    });

    // ── Pattern 2: extract directives (SAVE + TOOL), persist saves, execute tools ──
    const parsed = extractDirectives(response.text);
    let cleanedText = parsed.cleanedText;

    const savedAuto: any[] = [];
    const autoSavedForReflection: Array<{ category: string; value: string }> = [];

    for (const d of parsed.saves) {
      try {
        const result = await saveMemory({
          operator: primary,
          category: d.category,
          value: d.value,
          relatedOperators: secondaries,
        });
        if (result) {
          savedAuto.push(result);
          autoSavedForReflection.push({ category: d.category, value: d.value });
        }
      } catch (err) {
        console.error("[aurelius] auto save failed:", err);
      }
    }

    // Execute TOOL directives synchronously, then append a summary to the reply.
    let executedTools: ExecutedTool[] = [];
    let pass2Outcomes: Pass2Outcome[] = [];

    if (parsed.tools.length > 0) {
      executedTools = await executeToolDirectives(parsed.tools, primary);

      // ── Phase 4 Pass 2: training reasoning after eligible tool successes ──
      const pass2A = await firePass2ForLoggedSessions(executedTools);
      const pass2B = await firePass2ForReviewRecent(executedTools);
      pass2Outcomes = [...pass2A, ...pass2B];

      const toolSummary = summarizeToolResults(executedTools);
      const pass2Summary = summarizePass2(pass2Outcomes);
      if (toolSummary) cleanedText = cleanedText + "\n" + toolSummary;
      if (pass2Summary) cleanedText = cleanedText + "\n" + pass2Summary;
    }

    // Strip directives from reviewer response if present (and persist any saves it produced)
    let cleanedReviewed = response.reviewed;
    if (response.reviewed) {
      const r = extractDirectives(response.reviewed.text);
      for (const d of r.saves) {
        try {
          const result = await saveMemory({
            operator: primary,
            category: d.category,
            value: d.value,
            relatedOperators: secondaries,
          });
          if (result) {
            savedAuto.push(result);
            autoSavedForReflection.push({ category: d.category, value: d.value });
          }
        } catch (err) {
          console.error("[aurelius] auto save (reviewer) failed:", err);
        }
      }
      cleanedReviewed = { ...response.reviewed, text: r.cleanedText };
    }

    // ── Trigger 2: auto-fire reflection on meaningful memory writes ──
    let reflectionsTriggered = 0;

    if (
      explicitSavedCategory &&
      explicitSavedValue &&
      REFLECTION_CATEGORIES.has(explicitSavedCategory)
    ) {
      fireBackgroundReflection({
        primary,
        secondaries,
        category: explicitSavedCategory,
        value: explicitSavedValue,
      });
      reflectionsTriggered++;
    }

    for (const m of autoSavedForReflection) {
      if (REFLECTION_CATEGORIES.has(m.category)) {
        fireBackgroundReflection({
          primary,
          secondaries,
          category: m.category,
          value: m.value,
        });
        reflectionsTriggered++;
      }
    }

    return res.json({
      reply: cleanedText,
      operators: { primary, secondaries },
      meta: {
        engine: response.engine,
        model: response.model,
        tokensUsed: response.tokensUsed,
        latencyMs: response.latencyMs,
        memoriesSaved: {
          explicit: savedExplicit.length,
          auto: savedAuto.length,
        },
        reflectionsTriggered,
        toolsExecuted: executedTools.length,
        toolsSucceeded: executedTools.filter((e) => e.result.ok).length,
        pass2Sessions: pass2Outcomes.length,
        pass2Succeeded: pass2Outcomes.filter((o) => o.ok).length,
      },
      tools: executedTools.map((e) => ({
        tool: e.directive.tool,
        action: e.directive.action,
        ok: e.result.ok,
        error: e.result.error,
        output: e.result.output,
        durationMs: e.result.durationMs,
      })),
      pass2: pass2Outcomes,
      reviewed: cleanedReviewed || null,
    });
  } catch (err: any) {
    console.error("Aurelius error:", err);
    return res.status(500).json({
      error: "Aurelius encountered an issue.",
      detail: err?.message || String(err),
    });
  }
});

// ═══════════════════════════════════════════════════════════════════
// Research endpoint
// POST /api/aurelius/research
// Body: { query, operator?, depth?, secondaryOperators? }
// Returns synthesis + insights + contradictions, persists to memory.
// ═══════════════════════════════════════════════════════════════════

app.post("/api/aurelius/research", async (req: Request, res: Response) => {
  const { query, operator, depth, secondaryOperators } = req.body;

  if (!query || typeof query !== "string") {
    return res.status(400).json({ error: "query is required" });
  }

  try {
    // If no operator specified, route from the query itself.
    let primary = operator;
    let secondaries: string[] = secondaryOperators ?? [];

    if (!primary) {
      const routing = routeOperators(query);
      primary = routing.primary;
      if (secondaries.length === 0) {
        secondaries = routing.secondaries;
      }
    }

    const result = await runResearch({
      query,
      operator: primary,
      depth,
      secondaryOperators: secondaries,
    });

    return res.json({
      query: result.query,
      operators: { primary, secondaries },
      synthesis: result.synthesis,
      insights: result.insights,
      contradictions: result.contradictions,
      meta: {
        rawResultCount: result.rawResults.length,
        memoriesSaved: result.savedMemoryIds.length,
      },
    });
  } catch (err: any) {
    console.error("Research error:", err);
    return res.status(500).json({
      error: "Research failed",
      detail: err?.message || String(err),
    });
  }
});

// ═══════════════════════════════════════════════════════════════════
// Athlete-to-sheet registration endpoint
// POST /api/aurelius/register-sheet
// Body: { client: "Mike", sheetId: "abc123", sport?: string, position?: string }
//
// Saves a sheet mapping to memory (clients category) so Aurelius can resolve
// the right sheet when Cole references an athlete by name. One-time per athlete.
// ═══════════════════════════════════════════════════════════════════

app.post("/api/aurelius/register-sheet", async (req: Request, res: Response) => {
  const { client, sheetId, sport, position } = req.body;

  if (!client || typeof client !== "string") {
    return res.status(400).json({ error: "client (name) is required" });
  }
  if (!sheetId || typeof sheetId !== "string") {
    return res.status(400).json({ error: "sheetId is required" });
  }

  try {
    const valueParts: string[] = [`${client} — registered training sheet`];
    if (sport) valueParts.push(`sport: ${sport}`);
    if (position) valueParts.push(`position: ${position}`);
    const value = valueParts.join(" · ");

    const saved = await saveMemory({
      operator: "training",
      category: "clients",
      value,
      relatedOperators: ["business"],
      metadata: {
        clientName: client,
        sheetId,
        sport: sport ?? null,
        position: position ?? null,
        registeredAt: new Date().toISOString(),
        kind: "sheet_registration",
      },
    });

    return res.json({
      ok: true,
      client,
      sheetId,
      memoryId: saved?.id ?? null,
    });
  } catch (err: any) {
    console.error("[register-sheet] error:", err);
    return res.status(500).json({
      error: "Registration failed",
      detail: err?.message ?? String(err),
    });
  }
});

const PORT = Number(process.env.PORT) || 3001;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Aurelius server running on port ${PORT}`);
});