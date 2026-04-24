/**
 * aurelius/index.ts
 * Aurelius OS v3.4 — Unified Server Entry Point
 */

import dotenv from "dotenv";
dotenv.config({ path: "./.env" });

import express, { type Request, type Response } from "express";
import cors from "cors";

// Canonical engine routing
import { routeTask } from "./core/engineRouter.ts";

// Operator routing
import { routeOperator } from "./router/operatorRouter.ts";

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
    credentials: true
  })
);

console.log("ENV CHECK — Aurelius OS v3.4");
console.log("OPENAI_API_KEY:", !!process.env.OPENAI_API_KEY);
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
  res.send("Aurelius OS v3.4 backend is running");
});

// Main Aurelius chat endpoint
app.post("/api/aurelius", async (req: Request, res: Response) => {
  const { message } = req.body;

  if (!message || typeof message !== "string") {
    return res.status(400).json({ error: "Message is required" });
  }

  try {
    // Determine operator from message
    const operator = routeOperator(message);

    const systemPrompt = `You are Aurelius OS v3.4. Active operator: ${operator}. Respond with precision, clarity, and operator-grade reasoning.`;

    // Canonical task shape
    const result = await routeTask(
      {
        id: `chat-${Date.now()}`,
        type: "chat",
        payload: { message },
        engine: operator,
        source: "operator",
      },
      { message },
      systemPrompt
    );

    return res.json({
      reply: result.text,
      operator,
      meta: {
        engine: operator,
        tokensUsed: result.tokensUsed
      }
    });
  } catch (err) {
    console.error("Aurelius error:", err);
    return res.status(500).json({ error: "Aurelius encountered an issue." });
  }
});

const PORT = Number(process.env.PORT) || 3001;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Aurelius server running on port ${PORT}`);
}); 
