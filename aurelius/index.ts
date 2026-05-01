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
  parseAutoSaveDirectives,
  loadMemoriesForOperator,
} from "./memory/memoryService.ts";
// Reflection
import { reflectAndSave } from "./autonomy/reflectionEngine.ts";
// Research
import { runResearch } from "./research/researchEngine.ts";
// Register all engines once
import { registerAllEngines } from "./core/registerEngines.ts";
registerAllEngines();

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

    // ── Pattern 2: parse auto-save directives, persist, strip from text ──
    const { cleanedText, directives } = parseAutoSaveDirectives(response.text);

    const savedAuto: any[] = [];
    const autoSavedForReflection: Array<{ category: string; value: string }> = [];

    for (const d of directives) {
      try {
        const result = await saveMemory({
          operator: primary,
          category: d.category,
          value: d.value,
          relatedOperators: d.relatedOperators ?? secondaries,
        });
        if (result) {
          savedAuto.push(result);
          autoSavedForReflection.push({ category: d.category, value: d.value });
        }
      } catch (err) {
        console.error("[aurelius] auto save failed:", err);
      }
    }

    // Strip directives from reviewer response if present (and persist any it produced)
    let cleanedReviewed = response.reviewed;
    if (response.reviewed) {
      const r = parseAutoSaveDirectives(response.reviewed.text);
      for (const d of r.directives) {
        try {
          const result = await saveMemory({
            operator: primary,
            category: d.category,
            value: d.value,
            relatedOperators: d.relatedOperators ?? secondaries,
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
    // Fires AFTER the response is computed but BEFORE it's sent. Runs in background.
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
      },
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

const PORT = Number(process.env.PORT) || 3001;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Aurelius server running on port ${PORT}`);
});