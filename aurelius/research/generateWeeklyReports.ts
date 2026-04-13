/**
 * generateWeeklyReports.ts
 * Aurelius OS v3.4 — Weekly Intelligence Report Generator
 *
 * Responsibilities:
 *  - Read the research corpus
 *  - Read operator cores
 *  - Generate a weekly intelligence briefing
 *  - Use DeepSeek + Gemini + xAI for synthesis
 */

import fs from "fs";
import path, { dirname } from "path";
import { fileURLToPath } from "url";

import { deepseekChat } from "../engines/deepseekClient.ts";
import { xaiChat } from "../engines/xaiClient.ts";
import { GoogleGenerativeAI } from "@google/generative-ai";

// ESM-safe __dirname replacement
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

// Paths
const CORPUS_PATH = path.join(__dirname, "../../data/research_corpus.json");
const CORES_PATH = path.join(__dirname, "../../data/cores");

/**
 * Load JSON safely.
 */
function loadJSON(filePath: string) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

/**
 * Load all operator cores.
 */
function loadOperatorCores() {
  return {
    performance: loadJSON(path.join(CORES_PATH, "performance.json")),
    training: loadJSON(path.join(CORES_PATH, "training.json")),
    strategy: loadJSON(path.join(CORES_PATH, "strategy.json")),
    finance: loadJSON(path.join(CORES_PATH, "finance.json")),
    identity: loadJSON(path.join(CORES_PATH, "identity.json"))
  };
}

/**
 * Load the full research corpus.
 */
function loadCorpus() {
  if (!fs.existsSync(CORPUS_PATH)) return null;
  return JSON.parse(fs.readFileSync(CORPUS_PATH, "utf8"));
}

/**
 * Generate a broad weekly summary using Gemini.
 */
async function generateGeminiSummary(corpus: any) {
  try {
    const model = gemini.getGenerativeModel({ model: "gemini-pro" });

    const result = await model.generateContent(`
You are Aurelius — generate a high-level weekly summary of the research corpus.

CORPUS:
${JSON.stringify(corpus, null, 2)}

Rules:
- Identify major themes
- Identify new principles
- Identify contradictions
- Identify emerging trends
- Be concise and structured
`);

    return result.response.text();
  } catch (err) {
    console.error("Gemini weekly summary error:", err);
    return "Gemini summary failed.";
  }
}

/**
 * Generate a strategic synthesis using DeepSeek.
 */
async function generateDeepSeekSynthesis(corpus: any, cores: any) {
  return await deepseekChat(
    "You are Aurelius — strategic intelligence engine.",
    `
Generate a strategic synthesis of the week.

CORPUS:
${JSON.stringify(corpus, null, 2)}

OPERATOR CORES:
${JSON.stringify(cores, null, 2)}

Rules:
- Extract strategic insights
- Identify leverage points
- Identify compounding opportunities
- Identify systemic risks
- Produce structured JSON
`
  );
}

/**
 * Generate creative insights using xAI.
 */
async function generateXaiInsights(corpus: any, cores: any) {
  return await xaiChat(
    "You are Aurelius — creative synthesis engine.",
    `
Generate creative insights and alternative perspectives for the weekly report.

CORPUS:
${JSON.stringify(corpus, null, 2)}

OPERATOR CORES:
${JSON.stringify(cores, null, 2)}

Rules:
- Provide alternative angles
- Provide creative interpretations
- Provide unexpected connections
- Keep it actionable
`
  );
}

/**
 * MASTER WEEKLY REPORT FUNCTION
 */
export async function generateWeeklyReport() {
  console.log("Generating weekly intelligence report...");

  const corpus = loadCorpus();
  const cores = loadOperatorCores();

  if (!corpus) {
    console.warn("No corpus found — cannot generate weekly report.");
    return null;
  }

  const [summary, synthesis, insights] = await Promise.all([
    generateGeminiSummary(corpus),
    generateDeepSeekSynthesis(corpus, cores),
    generateXaiInsights(corpus, cores)
  ]);

  const finalReport = {
    timestamp: new Date().toISOString(),
    summary,
    synthesis,
    insights
  };

  console.log("Weekly intelligence report generated.");
  return finalReport;
}
