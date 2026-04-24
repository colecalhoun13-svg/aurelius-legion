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
// Operator routing
import { routeOperator } from "./router/operatorRouter.ts";
// Smart LLM routing (Phase 1)
import { runLLM } from "./llm/runLLM.ts";
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
console.log("===================================================");

// Phase 1 — engine test route
app.use("/api", engineTestRouter);

// Phase 3 — autonomy tick route
app.use("/api/autonomy", autonomyRouter);

app.get("/", (req: Request, res: Response) => {
  res.send("Aurelius OS backend is running");
});

// Main Aurelius chat endpoint — Phase 1: smart routing via runLLM
app.post("/api/aurelius", async (req: Request, res: Response) => {
  const {
    message,
    options,
    taskType,
    urgency,
    autonomyMode,
    needsRealtime,
    hasMultimodal,
  } = req.body;

  if (!message || typeof message !== "string") {
    return res.status(400).json({ error: "Message is required" });
  }

  try {
    // Determine operator from message
    const operator = routeOperator(message);

    // Run through smart router
    const response = await runLLM({
      taskType: taskType || "chat",
      operator,
      autonomyMode,
      urgency,
      input: message,
      options,
      needsRealtime,
      hasMultimodal,
    });

    return res.json({
      reply: response.text,
      operator,
      meta: {
        engine: response.engine,
        model: response.model,
        tokensUsed: response.tokensUsed,
        latencyMs: response.latencyMs,
      },
      reviewed: response.reviewed || null,
    });
  } catch (err: any) {
    console.error("Aurelius error:", err);
    return res.status(500).json({
      error: "Aurelius encountered an issue.",
      detail: err?.message || String(err),
    });
  }
});

const PORT = Number(process.env.PORT) || 3001;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Aurelius server running on port ${PORT}`);
});