/**
 * aurelius/index.ts
 * Aurelius OS — Unified Server Entry Point
 */
import dotenv from "dotenv";
dotenv.config({ path: "./.env" });

import express, { type Request, type Response } from "express";
import cors from "cors";

// Multi-operator routing
import { routeOperatorsSemantic } from "./router/operatorRouter.ts";
// Smart LLM routing
import { runLLM } from "./llm/runLLM.ts";
import { routeLLM } from "./llm/router.ts";
// Memory service (multi-operator aware)
import {
  saveMemory,
  loadMemoriesForOperator,
  findClientSheetId,
} from "./memory/memoryService.ts";
// Centralized directive parser ([SAVE:], [TOOL:], [KNOWLEDGE_UPDATE_*:])
import { extractDirectives, type ToolDirective } from "./llm/directiveParser.ts";
// Phase 4.5 — Living Knowledge propose-confirm flow
import {
  createProposal,
  resolveProposal,
  getPendingProposals,
} from "./knowledge/proposals.ts";
import { resolveOperatorId } from "./knowledge/store.ts";
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
import { productivityRouter } from "./router/productivityRouter.ts";
import { corpusRouter } from "./router/corpusRouter.ts";
import { missionsRouter } from "./router/missionsRouter.ts";
import { ritualsRouter } from "./router/ritualsRouter.ts";
import { proposalsRouter } from "./router/proposalsRouter.ts";
import { wikiRouter } from "./router/wikiRouter.ts";
import { calendarRouter } from "./router/calendarRouter.ts";
import { correctionsRouter } from "./router/correctionsRouter.ts";
import { gmailRouter } from "./router/gmailRouter.ts";

// Structured tracing — every request and scheduled run leaves a LogEntry
// row the cockpit can read. Telemetry is fire-and-forget by design.
import { runTraced, requestTracer, logBootMarker } from "./core/trace.ts";

// ─────────────────────────────────────────────────────────────────────────
// STAY ALIVE — Aurelius is an always-on OS with a scheduled spine (06:00 RSS →
// 21:30 debrief → weekly sweeps). Node's default is to CRASH the whole process
// on any unhandled promise rejection or uncaught exception — so one stray throw
// in a fire-and-forget scheduled job (an unfunded engine, a slept Neon, a
// Telegram blip) would take the entire OS down until manually restarted. For a
// single-operator personal system, surviving loudly beats dying silently: log
// the failure with its origin, keep serving. (These MUST be registered before
// anything async can throw — hence the top of the file.)
process.on("unhandledRejection", (reason: any) => {
  const msg = reason?.stack ?? reason?.message ?? String(reason);
  console.error(`[FATAL-GUARD] Unhandled promise rejection (surviving): ${msg}`);
});
process.on("uncaughtException", (err: any) => {
  const msg = err?.stack ?? err?.message ?? String(err);
  console.error(`[FATAL-GUARD] Uncaught exception (surviving): ${msg}`);
});

const app = express();
app.use(express.json({ limit: "25mb" })); // room for base64 photos / short clips attached in chat
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true,
  })
);
app.use("/api", requestTracer("/api"));

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
app.use("/api/productivity", productivityRouter);
app.use("/api/corpus", corpusRouter);
app.use("/api/missions", missionsRouter);
app.use("/api/rituals", ritualsRouter);
app.use("/api/proposals", proposalsRouter);
app.use("/api/wiki", wikiRouter);
app.use("/api/calendar", calendarRouter);
app.use("/api/corrections", correctionsRouter);
app.use("/api/gmail", gmailRouter);

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
    } else {
      console.log(`[tool-call] ok — ${JSON.stringify(result.output ?? {}).slice(0, 300)}`);
    }

    executed.push({ directive, result, resolvedClientId });
  }

  return executed;
}

// True when some read action returned literal data rows (sessions, dashboard
// cells, …). Those are ground truth: even a synthesized prose answer should keep
// them, so a paraphrase that drifts on a number isn't the only thing Cole sees.
function hasGroundTruthRows(executed: ExecutedTool[]): boolean {
  const KEYS = ["rows", "tasks", "goals", "rituals", "athletes", "overdue", "sessionsToReview"];
  return executed.some(
    (e) =>
      e.result.ok &&
      KEYS.some((k) => Array.isArray((e.result.output as any)?.[k]) && (e.result.output as any)[k].length > 0)
  );
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

      // Cole's own lane (productivity/planning reads) — the ground truth beneath
      // any synthesized prose, so a paraphrase that drops or renames a task/goal
      // isn't the only thing he sees.
      if (Array.isArray(output.tasks)) {
        for (const t of output.tasks as any[]) {
          const due = t.dueDate ? ` (due ${new Date(t.dueDate).toISOString().slice(0, 10)})` : "";
          lines.push(`   • ${t.title}${t.priority && t.priority !== "normal" ? ` [${t.priority}]` : ""}${due}`);
        }
      }
      if (Array.isArray(output.overdue) && output.overdue.length) {
        for (const t of output.overdue as any[]) lines.push(`   ⚠ overdue: ${t.title}`);
      }
      if (Array.isArray(output.goals) && ex.directive.tool === "productivity") {
        for (const g of output.goals as any[]) lines.push(`   • ${g.name}${g.progressPct != null ? ` — ${g.progressPct}%` : ""}`);
      }
      if (Array.isArray(output.rituals)) {
        for (const r of output.rituals as any[]) lines.push(`   • ${r.label} ${r.time}${r.enabled === false ? " [paused]" : ""}`);
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
    options,
    taskType,
    urgency,
    autonomyMode,
    needsRealtime,
    hasMultimodal,
    save: explicitSave,
    media, // { mimeType, data (base64), kind?, filename? } — attached in chat
  } = req.body;

  let message: string = typeof req.body?.message === "string" ? req.body.message : "";

  if (!message.trim() && !media) {
    return res.status(400).json({ error: "Message or media is required" });
  }

  // Multimodal chat: Cole attached one or more photos/videos. Aurelius "sees"
  // each — the analyses fold into the message so the model reasons over them in
  // conversation — and remembers each in the second brain (fire-and-forget).
  // Accepts `media` as a single object (back-compat) or an array (multi-drop).
  const mediaItems: any[] = Array.isArray(media) ? media : media ? [media] : [];
  if (mediaItems.length > 0) {
    const { analyzeMedia, captureMediaNote } = await import("./media/ingestMedia.ts");
    for (const m of mediaItems) {
      if (!m?.data || !m?.mimeType) continue;
      const label = m.filename ? ` (${m.filename})` : "";
      try {
        const { kind, analysis } = await analyzeMedia(
          Buffer.from(m.data, "base64"),
          m.mimeType,
          req.body?.message?.trim() || undefined
        );
        message =
          (message.trim() ? message.trim() + "\n\n" : "") +
          `[Cole attached a ${kind}${label}. What I can see in it:]\n${analysis}`;
        captureMediaNote({ kind, analysis, caption: req.body?.message, filename: m.filename }).catch(() => {});
      } catch (err: any) {
        message =
          (message.trim() ? message.trim() + "\n\n" : "") +
          `[Cole attached a file${label} but I couldn't read it: ${err?.message ?? err}]`;
      }
    }
  }

  try {
    // Multi-operator routing — semantic (embedding-blended) when available,
    // keyword otherwise (master-class #6).
    const routing = await routeOperatorsSemantic(message);
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
    // Phase 4.5: Resolve operatorId for knowledge update flow
    let primaryOperatorId: string | null = null;
    try {
      primaryOperatorId = await resolveOperatorId(primary);
    } catch (err) {
      console.warn("[aurelius] could not resolve operatorId for", primary, err);
    }

    const response = await runLLM({
      taskType: taskType || "chat",
      operators: { primary, secondaries },
      autonomyMode,
      urgency,
      input: message,
      options,
      needsRealtime,
      hasMultimodal,
      knowledgeContext: primaryOperatorId
        ? { operatorId: primaryOperatorId, operatorName: primary }
        : undefined,
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

      // ── Tool-result feedback: the model READS the results and writes the
      // answer from them. Without this a search/read tool's output never
      // reaches the model — it only saw a terse "completed" summary after the
      // fact, so web.search felt empty even when it worked. One extra LLM turn,
      // no more tool calls (loop-safe: we strip any directives from it).
      let synthesized = "";
      if (executedTools.some((e) => e.result.ok)) {
        const resultsForModel = executedTools
          .map((e) => {
            const head = `${e.directive.tool}.${e.directive.action}`;
            return e.result.ok
              ? `[${head}] →\n${JSON.stringify(e.result.output ?? {}, null, 2).slice(0, 7000)}`
              : `[${head}] FAILED: ${e.result.error}`;
          })
          .join("\n\n");
        try {
          const synth = await routeLLM({
            taskType: "chat",
            operators: { primary, secondaries },
            input:
              `${message}\n\n[These are the results of the tool(s) you just ran. Write your answer to Cole USING them — synthesize, be specific, and cite the source links when present. Do NOT call any more tools.]\n\n${resultsForModel}`,
          });
          synthesized = extractDirectives(synth.text ?? "").cleanedText.trim();
        } catch (err) {
          console.warn("[aurelius] tool-result synthesis failed (non-fatal):", (err as any)?.message ?? err);
        }
      }

      if (synthesized) {
        cleanedText = synthesized; // the real answer replaces the pre-tool preamble
        // …but never at the cost of ground truth: if a read action returned
        // literal rows, append them beneath so Cole sees the data, not only the
        // model's paraphrase of it (silent hallucination is what these prevent).
        if (hasGroundTruthRows(executedTools)) {
          const toolSummary = summarizeToolResults(executedTools);
          if (toolSummary) cleanedText = cleanedText + "\n" + toolSummary;
        }
      } else {
        const toolSummary = summarizeToolResults(executedTools);
        if (toolSummary) cleanedText = cleanedText + "\n" + toolSummary;
      }
      const pass2Summary = summarizePass2(pass2Outcomes);
      if (pass2Summary) cleanedText = cleanedText + "\n" + pass2Summary;
    }

    // ── Phase 4.5: Handle knowledge update directives ──
    const knowledgeProposalsCreated: Array<{ id: string; scope: string; key: string }> = [];
    const knowledgeProposalsResolved: Array<{ id: string; decision: string }> = [];

    if (primaryOperatorId && parsed.knowledgeProposals.length > 0) {
      for (const dir of parsed.knowledgeProposals) {
        const d = dir.data;
        if (!d.intentClassId || !d.scope || !d.key || d.proposedValue === undefined) {
          console.warn("[aurelius] KNOWLEDGE_UPDATE_PROPOSE missing fields:", d);
          continue;
        }
        try {
          const proposal = await createProposal({
            operatorId: primaryOperatorId,
            operatorName: primary,
            intentClassId: d.intentClassId,
            scope: d.scope,
            key: d.key,
            proposedValue: d.proposedValue,
            rationale: d.rationale ?? "",
            coleNaturalLanguage: d.coleNaturalLanguage ?? message,
          });
          knowledgeProposalsCreated.push({
            id: proposal.id,
            scope: proposal.scope,
            key: proposal.key,
          });
        } catch (err) {
          console.error("[aurelius] createProposal failed:", err);
        }
      }
    }

    if (primaryOperatorId && parsed.knowledgeConfirmations.length > 0) {
      for (const dir of parsed.knowledgeConfirmations) {
        const d = dir.data;
        if (!d.proposalId || !d.decision) {
          console.warn("[aurelius] KNOWLEDGE_UPDATE_CONFIRM missing fields:", d);
          continue;
        }
        if (!["confirmed", "denied", "corrected"].includes(d.decision)) {
          console.warn("[aurelius] KNOWLEDGE_UPDATE_CONFIRM invalid decision:", d.decision);
          continue;
        }
        // SECURITY: a KNOWLEDGE_UPDATE_CONFIRM is a directive the MODEL emits, and
        // recalled corpus/memory/email text feeds the prompt — so a poisoned source
        // could induce a confirm. Blast radius is bounded (inward, reversible,
        // Bridge-surfaced Living-Knowledge writes) EXCEPT one class: enabling
        // standing auto-apply (scope "autonomy") would widen every future write.
        // Never let a model directive turn THAT on — it must be an explicit Cole
        // action on the Bridge/HTTP. Deny + confirm-to-apply only for that scope.
        if (d.decision === "confirmed") {
          try {
            const { getProposalById } = await import("./knowledge/proposals.ts");
            const prop = await getProposalById(primaryOperatorId, d.proposalId);
            if (prop && prop.scope === "autonomy") {
              console.warn(`[aurelius] refusing model-emitted confirm for autonomy-scope proposal ${d.proposalId} — needs an explicit Cole tap`);
              continue;
            }
          } catch (err) {
            console.warn("[aurelius] autonomy-scope confirm guard check failed:", (err as any)?.message ?? err);
          }
        }
        try {
          const resolved = await resolveProposal({
            operatorId: primaryOperatorId,
            proposalId: d.proposalId,
            decision: d.decision as "confirmed" | "denied" | "corrected",
            coleResponseText: d.coleResponseText ?? message,
            correctedValue: d.correctedValue,
          });
          if (resolved) {
            knowledgeProposalsResolved.push({
              id: resolved.id,
              decision: resolved.status,
            });
          }
        } catch (err) {
          console.error("[aurelius] resolveProposal failed:", err);
        }
      }
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

    // ── Never return an empty bubble ──
    // If the model answered with only directives (a silent SAVE/TOOL/
    // knowledge proposal) the visible text strips to "". Rather than send an
    // empty reply, acknowledge what actually happened. Also covers a genuinely
    // empty LLM response (provider hiccup) — we say so instead of going silent.
    if (!cleanedText || !cleanedText.trim()) {
      const acks: string[] = [];
      if (savedExplicit.length || savedAuto.length) acks.push("Noted — I've saved that.");
      if (executedTools.length) {
        const ok = executedTools.filter((e) => e.result.ok).length;
        acks.push(ok === executedTools.length ? "Done." : `Ran ${ok}/${executedTools.length} actions.`);
      }
      if (knowledgeProposalsCreated.length) acks.push("I've proposed a knowledge update for your confirmation.");
      cleanedText =
        acks.join(" ") ||
        "I didn't get a response together on that one — mind rephrasing or asking again?";
      console.warn("[aurelius] empty reply text — used fallback", {
        tokensUsed: response.tokensUsed,
        engine: response.engine,
        saves: savedExplicit.length + savedAuto.length,
        tools: executedTools.length,
        proposals: knowledgeProposalsCreated.length,
      });
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

    // Conversation continuity: persist both turns (fire-and-forget).
    import("./memory/conversation.ts")
      .then((m) =>
        m.recordTurns({
          coleMessage: message,
          aureliusReply: cleanedText,
          operatorName: primary,
          engine: response.engine,
        })
      )
      .catch(() => {});

    // Close the compile loop: mine this exchange for a recurring heuristic
    // (fire-and-forget — never blocks the reply). Everyday chat now compiles, not
    // just the training room; a repeated kind of exchange becomes a Bridge-
    // confirmable heuristic that then grounds future prompts.
    if (primaryOperatorId) {
      import("./compiled/chatCompiler.ts")
        .then((m) => m.compileFromChat({ operatorId: primaryOperatorId!, operatorName: primary, input: message, answer: cleanedText }))
        .catch(() => {});
    }

    // Telemetry read for the response meta — must NOT sink a fully-computed
    // answer. A DB blip on this count previously threw inside res.json()'s
    // object literal (it's in the outer try), discarding the whole turn and
    // handing Cole an error for a reply that was ready. Compute it defensively.
    let pendingProposalsAfter = 0;
    try {
      pendingProposalsAfter = primaryOperatorId
        ? (await getPendingProposals(primaryOperatorId)).length
        : 0;
    } catch (err) {
      console.warn("[aurelius] pendingProposals count failed (non-fatal):", (err as any)?.message ?? err);
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
        knowledgeProposalsCreated: knowledgeProposalsCreated.length,
        knowledgeProposalsResolved: knowledgeProposalsResolved.length,
        pendingProposalsAfter,
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
      const routing = await routeOperatorsSemantic(query);
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

// ═══════════════════════════════════════════════════════════════════
// The Pulse — scheduled background loops (nervous system v1)
// Nightly at 21:30: close the day, compute intent-vs-action gap.
// Sunday 09:00: weekend research pass → proposals for Monday review.
// ═══════════════════════════════════════════════════════════════════
// Named schedule registry: every ritual registers by name so Cole can re-time it
// from chat ("move my brief to 6:30") — the change reschedules the live job and
// persists. Defaults below stay the source of truth for cadence/day-of-week.
import { scheduleNamed, applyScheduleOverrides } from "./core/schedule.ts";
import { runWeekendPulse } from "./autonomy/pulse.ts";
import {
  ensureRituals,
  generateMorningBriefing,
  generateNightlyDebrief,
} from "./rituals/engine.ts";
import { computeWeeklySnapshot } from "./measurement/scoreboard.ts";
import { startTelegramBridge, sendToCole } from "./telegram/bot.ts";

// Ordered DB-dependent boot: WAKE Neon first, then run the reads that would
// otherwise race a cold DB — reap stranded confirms (inward only; see reaper).
// Schedule-override apply + catch-up are chained after the initiative import
// registers (below), also after warmup, so a paused/re-timed ritual isn't lost
// to a cold-DB read at boot.
(async () => {
  const { warmupDb } = await import("./core/db/prisma.ts");
  await warmupDb();
  const { reapStaleActing } = await import("./autonomy/executor.ts");
  await reapStaleActing();
})().catch((err) => console.error("[boot] db-dependent init failed:", err));

ensureRituals().catch((err) => console.error("[rituals] seed failed:", err));
// The five living documents exist from first boot (founding editions).
import("./wiki/livingDocs.ts")
  .then((m) => m.ensureLivingDocuments())
  .catch((err) => console.error("[livingDocs] seed failed:", err));
// Wire every acting workflow's commit function into the action registry, so
// both the act-now and confirm-later paths can find a finalizer.
import("./autonomy/registerActions.ts")
  .then((m) => m.registerAllActions())
  .catch((err) => console.error("[autonomy] action registration failed:", err));
// Dormant without TELEGRAM_BOT_TOKEN; wakes the moment the token lands.
startTelegramBridge();
// Dormant without PAPERLESS_URL/TOKEN; wakes on the Mini.
import("./corpus/paperlessPoller.ts")
  .then((m) => m.startPaperlessPoller())
  .catch((err) => console.error("[paperless] init failed:", err));
// Google Calendar: dormant without creds, awaiting-auth with them, live
// after the one-time /api/calendar/auth. Syncs every 15 min once live.
import("./calendar/engine.ts")
  .then((m) => m.startCalendarSync())
  .catch((err) => console.error("[calendar] init failed:", err));
// Catch-up is started AFTER applyScheduleOverrides resolves (in the initiative
// import's .finally below) — otherwise catch-up could read pre-override registry
// state and fire a paused/moved ritual at its default time.

// Market pulse at 06:30 — crypto/equities/macro digest into the wealth
// corpus before the day starts. Signals only; Cole makes the calls.
scheduleNamed("market_pulse", "30 6 * * *", "market pulse", async () => {
  try {
    await runTraced("schedule", "market_pulse", async () => {
      const { runMarketPulse } = await import("./wealth/engine.ts");
      return runMarketPulse();
    });
  } catch (err) {
    console.error("[wealth] market pulse failed:", err);
  }
});
// RSS standing feeds at 06:00 — reading digests into the corpus. Dormant
// until research.rss_feeds exists in Living Knowledge.
scheduleNamed("rss_ingest", "0 6 * * *", "RSS ingest", async () => {
  try {
    await runTraced("schedule", "rss_ingest", async () => {
      const { pollRssOnce } = await import("./corpus/rssIngest.ts");
      return pollRssOnce();
    });
  } catch (err) {
    console.error("[rss] poll failed:", err);
  }
});
// Schedule-protection at 06:45 — defend deep-work time before the day fills.
// Acts on its own if granted (calendar.schedule_protection), else proposes on
// the Bridge; deduped so it never spams. Runs before the 07:00 briefing so the
// briefing reflects any holds just placed.
scheduleNamed("schedule_protection", "45 6 * * *", "schedule protection", async () => {
  try {
    await runTraced("schedule", "schedule_protection", async () => {
      const { runScheduleProtection } = await import("./autonomy/workflows/scheduleProtection.ts");
      await runScheduleProtection({ days: 5 });
    });
  } catch (err) {
    console.error("[scheduleProtection] daily sweep failed:", err);
  }
});
// Morning briefing at 07:00 — the day opens with a push, not a blank page.
scheduleNamed("morning_briefing", "0 7 * * *", "morning briefing", async () => {
  try {
    await runTraced("schedule", "morning_briefing", async () => {
      const { briefing } = await generateMorningBriefing();
      await sendToCole(briefing);
    });
  } catch (err) {
    console.error("[rituals] morning failed:", err);
  }
});
// Nightly debrief at 21:30 — wraps the deterministic pulse (gap math) in voice.
scheduleNamed("nightly_debrief", "30 21 * * *", "nightly debrief", async () => {
  try {
    await runTraced("schedule", "nightly_debrief", async () => {
      const { debrief } = await generateNightlyDebrief();
      await sendToCole(debrief);
    });
  } catch (err) {
    console.error("[rituals] nightly failed:", err);
  }
});
// Midday check at 13:00 — corrective, and silent when Cole is on pace.
scheduleNamed("midday_check", "0 13 * * *", "midday check", async () => {
  try {
    await runTraced("schedule", "midday_check", async () => {
      const { runMiddayCheck } = await import("./planning/tools.ts");
      return runMiddayCheck();
    });
  } catch (err) {
    console.error("[planning] midday check failed:", err);
  }
});
// Persona observation — Sunday 17:00: how did Cole actually communicate
// this week? Calibration proposals land on the bench (propose, never impose).
scheduleNamed("persona_observer", "0 17 * * 0", "persona observer", async () => {
  try {
    await runTraced("schedule", "persona_observer", async () => {
      const { observeCommunicationStyle } = await import("./persona/observer.ts");
      return observeCommunicationStyle();
    });
  } catch (err) {
    console.error("[persona] observer failed:", err);
  }
});
// Weekly planning session — Sunday 18:00, after the research pass digests.
scheduleNamed("weekly_planning", "0 18 * * 0", "weekly planning", async () => {
  try {
    await runTraced("schedule", "weekly_planning", async () => {
      const { planWeekLite } = await import("./planning/tools.ts");
      const { briefing } = await planWeekLite();
      const { sendToCole } = await import("./telegram/bot.ts");
      await sendToCole(briefing);
    });
  } catch (err) {
    console.error("[planning] weekly session failed:", err);
  }
});
scheduleNamed("weekend_pulse", "0 9 * * 0", "weekend research pulse", async () => {
  try {
    await runTraced("schedule", "weekend_pulse", async () => {
      await runWeekendPulse();
      // After the research pass lands, the wiki absorbs the week.
      const { synthesizeAllDomains } = await import("./wiki/engine.ts");
      await synthesizeAllDomains("weekend_pulse");
    });
  } catch (err) {
    console.error("[pulse] weekend failed:", err);
  }
});
// Knowledge freshness — Sunday 19:00: stale entries get re-check
// proposals on the bench (capped, cooldown; propose, never impose).
scheduleNamed("freshness_sweep", "0 19 * * 0", "freshness sweep", async () => {
  try {
    await runTraced("schedule", "freshness_sweep", async () => {
      const { runFreshnessSweep } = await import("./knowledge/freshness.ts");
      return runFreshnessSweep();
    });
  } catch (err) {
    console.error("[freshness] sweep failed:", err);
  }
});
// Weekly scoreboard — Sunday 20:00, one honest snapshot of both lanes.
scheduleNamed("weekly_scoreboard", "0 20 * * 0", "weekly scoreboard", () => {
  runTraced("schedule", "weekly_scoreboard", () => computeWeeklySnapshot()).catch((err) =>
    console.error("[scoreboard] failed:", err)
  );
});
// Curriculum ingest — Sunday 22:00: Aurelius studies the next unit of each
// field's canon (strategy → Sun Tzu, Musashi, …; wealth → Buffett, Taleb, …;
// identity → the Stoics), ingests the synthesis into the second brain, and
// refreshes each touched field's wiki. Auto-learning the literature so every
// operator reasons from the best thinking in its domain, not the model default.
scheduleNamed("curriculum_ingest", "0 22 * * 0", "curriculum ingest", () => {
  runTraced("schedule", "curriculum_ingest", async () => {
    const { runCurriculumIngest } = await import("./learning/curriculum.ts");
    return runCurriculumIngest();
  }).catch((err) => console.error("[curriculum] failed:", err));
});
// Initiative — 08:00 daily, after the briefing: Aurelius scans its own
// state and proposes missions. Proposed only; Cole launches.
//
// Every other ritual registers synchronously above; this one is behind a dynamic
// import. Apply the persisted time/pause overrides ONLY after it registers, so a
// Cole-paused or re-timed initiative pulse isn't skipped by a boot race (the
// disabled-set loop does registry.has(name) with no retry).
import("./autonomy/initiative.ts")
  .then(({ runInitiativePulse }) => {
    scheduleNamed("initiative_pulse", "0 8 * * *", "initiative pulse", () => {
      runTraced("schedule", "initiative_pulse", () => runInitiativePulse()).catch((err) =>
        console.error("[initiative] failed:", err)
      );
    });
  })
  .catch((err) => console.error("[initiative] init failed:", err))
  .finally(async () => {
    // Every ritual (incl. initiative_pulse) is now registered. Apply Cole-set
    // time overrides + paused rituals, THEN start catch-up so it sees the live
    // (overridden/paused) state — never fires a moved or paused ritual.
    try {
      await applyScheduleOverrides();
    } catch (err) {
      console.error("[schedule] override apply failed:", err);
    }
    import("./core/catchUp.ts")
      .then((m) => m.startCatchUp())
      .catch((err) => console.error("[catchup] init failed:", err));
  });

// JSON error handler — MUST be last (after all routes). Without it, a body that
// exceeds the 25MB json limit (e.g. several photos attached at once) throws a
// body-parser 413 that Express renders as an empty/HTML response; the frontend
// proxy then sees `{}` and the chat silently does nothing. Turn parser failures
// into an honest JSON error the UI can show. (Arity 4 = Express error handler.)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: any, _req: Request, res: Response, _next: any) => {
  if (err?.type === "entity.too.large" || err?.status === 413) {
    return res.status(413).json({
      error:
        "Those attachments are too large to send at once (25MB total). Send fewer/smaller files, or a shorter clip.",
    });
  }
  if (err?.type === "entity.parse.failed" || err?.status === 400) {
    return res.status(400).json({ error: "Malformed request body." });
  }
  console.error("[express] unhandled error:", err?.message ?? err);
  return res.status(500).json({ error: "Aurelius hit an unexpected server error." });
});

const PORT = Number(process.env.PORT) || 3001;
app.listen(PORT, "0.0.0.0", () => {
  logBootMarker(); // cockpit uptime derives from the latest boot row
  console.log(`Aurelius server running on port ${PORT}`);
});