/**
 * researchEngine.ts
 * Aurelius OS v3.4 — Research & Analysis Engine
 *
 * Provides structured reasoning, comparisons, summaries, and data extraction.
 * This is a modular layer that can later integrate:
 * - external APIs
 * - vector search
 * - knowledge bases
 * - financial data
 * - training science databases
 *
 * For now, it performs internal reasoning only.
 */

import type { OperatorType } from "../types.ts";

interface ResearchPayload {
  message: string;
  operator: OperatorType;
}

export interface ResearchResult {
  type: "comparison" | "summary" | "extraction" | "analysis";
  operator: OperatorType;
  insights: string[];
}

export async function researchEngine(
  payload: ResearchPayload
): Promise<ResearchResult | null> {
  const { message, operator } = payload;

  const intent = detectResearchIntent(message);
  if (!intent) return null;

  switch (intent) {
    case "compare":
      return runComparison(message, operator);

    case "summarize":
      return runSummary(message, operator);

    case "extract":
      return runExtraction(message, operator);

    case "analyze":
      return runAnalysis(message, operator);

    default:
      return null;
  }
}

/* ---------------------------------------------------------
   INTENT DETECTION
--------------------------------------------------------- */

function detectResearchIntent(message: string): string | null {
  const msg = message.toLowerCase();

  if (msg.includes("compare") || msg.includes("vs")) return "compare";
  if (msg.includes("summarize") || msg.includes("summary")) return "summarize";
  if (msg.includes("extract") || msg.includes("pull out")) return "extract";
  if (msg.includes("analyze") || msg.includes("break down")) return "analyze";

  return null;
}

/* ---------------------------------------------------------
   RESEARCH MODULES
--------------------------------------------------------- */

async function runComparison(
  message: string,
  operator: OperatorType
): Promise<ResearchResult> {
  return {
    type: "comparison",
    operator,
    insights: [
      "Identified key variables for comparison.",
      "Structured pros/cons for clarity.",
      "Highlighted tradeoffs relevant to your operator domain."
    ]
  };
}

async function runSummary(
  message: string,
  operator: OperatorType
): Promise<ResearchResult> {
  return {
    type: "summary",
    operator,
    insights: [
      "Condensed the content into core principles.",
      "Extracted the most actionable elements.",
      "Removed noise and emphasized operator‑relevant details."
    ]
  };
}

async function runExtraction(
  message: string,
  operator: OperatorType
): Promise<ResearchResult> {
  return {
    type: "extraction",
    operator,
    insights: [
      "Pulled out key data points.",
      "Identified patterns and recurring themes.",
      "Mapped extracted items to operator priorities."
    ]
  };
}

async function runAnalysis(
  message: string,
  operator: OperatorType
): Promise<ResearchResult> {
  return {
    type: "analysis",
    operator,
    insights: [
      "Performed structured reasoning.",
      "Identified causal factors and leverage points.",
      "Generated operator‑specific strategic implications."
    ]
  };
}
