/**
 * aurelius/index.ts
 * Aurelius OS v3.4 — Server Entry Point
 *
 * Boots Express, loads .env, and routes messages into the system.
 */

// ======================================================
// LOAD ENVIRONMENT VARIABLES BEFORE ANYTHING ELSE
// ======================================================
import dotenv from "dotenv";
dotenv.config({ path: "../.env" });

// ======================================================
// DEBUG — Show actual working directory (critical)
// ======================================================
console.log("CWD:", process.cwd());

import express, { type Request, type Response } from "express";
import cors from "cors";
import schedule from "node-schedule";

// Routers (ESM requires explicit .ts extensions)
import { routeOperator } from "./router/operatorRouter.ts";
import { engineRouter } from "./core/engineRouter.ts";

// Weekly loop orchestrator
import { runWeeklyLoop } from "./research/weeklyLoop.ts";

const app = express();
app.use(express.json());

// ======================================================
// CORS FIX — REQUIRED FOR CODESPACES FRONTEND → BACKEND
// ======================================================
app.use(
  cors({
    origin: "https://musical-space-doodle-4jxpwg76jwxgcv5j-3000.app.github.dev",
    methods: ["GET", "POST"],
    credentials: true
  })
);

// ======================================================
// DEBUG — Confirm API keys are loading
// ======================================================
console.log("ENV CHECK — Aurelius OS v3.4");
console.log("OPENAI_API_KEY:", !!process.env.OPENAI_API_KEY);
console.log("GROQ_API_KEY:", !!process.env.GROQ_API_KEY);
console.log("GEMINI_API_KEY:", !!process.env.GEMINI_API_KEY);
console.log("DEEPSEEK_API_KEY:", !!process.env.DEEPSEEK_API_KEY);
console.log("XAI_API_KEY:", !!process.env.XAI_API_KEY);
console.log("ANTHROPIC_API_KEY:", !!process.env.ANTHROPIC_API_KEY);
console.log("===================================================");

// ======================================================
// BASIC HEALTH CHECK
// ======================================================
app.get("/", (req: Request, res: Response) => {
  res.send("Aurelius OS v3.4 is running");
});

// ======================================================
// MAIN AI ROUTE — FRONTEND SENDS { message }
// ======================================================
app.post("/api/aurelius", async (req: Request, res: Response) => {
  const { message } = req.body;

  if (!message) {
    return res.status(400).json({ error: "Message is required" });
  }

  try {
    // 1. Determine operator
    const operator = routeOperator(message);

    // 2. Build system prompt
    const systemPrompt = `You are Aurelius OS v3.4. Operator: ${operator}. Respond with precision.`;

    // 3. Route to correct engine (Claude, Groq, DeepSeek, Gemini, OpenAI, XAI)
    const reply = await engineRouter(operator, systemPrompt, message);

    return res.json({ reply });
  } catch (err) {
    console.error("Aurelius error:", err);
    return res.status(500).json({ error: "Aurelius encountered an issue." });
  }
});

// ======================================================
// MANUAL WEEKLY LOOP TRIGGER
// ======================================================
app.post("/run-weekly", async (req: Request, res: Response) => {
  const { topic } = req.body;

  if (!topic) {
    return res.status(400).json({ error: "Missing topic field." });
  }

  const result = await runWeeklyLoop(topic);
  res.json(result);
});

// ======================================================
// SCHEDULED WEEKLY INTELLIGENCE LOOP
// Runs every Monday at 9:00 AM
// ======================================================
schedule.scheduleJob("0 9 * * 1", () => {
  console.log("Scheduled weekly intelligence loop triggered...");
  runWeeklyLoop("weekly autonomous research");
});

// ======================================================
// START SERVER — MUST bind to 0.0.0.0 for Codespaces
// ======================================================
const PORT = Number(process.env.PORT) || 3001;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Aurelius server running on port ${PORT}`);
});
