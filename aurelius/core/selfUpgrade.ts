/**
 * selfUpgrade.ts
 * Aurelius OS v3.4 — Adaptive Self‑Upgrade Engine
 *
 * Aurelius learns from:
 * - operator usage patterns
 * - engine performance
 * - user tone + intent
 * - workflow outcomes
 * - memory insights
 *
 * This engine does NOT rewrite code.
 * It updates internal heuristics + preferences.
 */

import type { OperatorType } from "../types.ts";

interface SelfUpgradePayload {
  operator: OperatorType;
  engine: string;
  message: string;
  engineResponse: string;
}

export interface SelfUpgradeResult {
  tone: string;
  drift: string | null;
  performance: string;
  upgrades: string[];
}

export async function selfUpgrade(
  payload: SelfUpgradePayload
): Promise<SelfUpgradeResult> {
  const { operator, engine, message, engineResponse } = payload;

  const tone = detectTone(message);
  const drift = detectOperatorDrift(message, operator);
  const performance = evaluateEnginePerformance(engineResponse);

  const upgrades = buildUpgradeActions({
    operator,
    engine,
    tone,
    drift,
    performance
  });

  return {
    tone,
    drift,
    performance,
    upgrades
  };
}

/* ---------------------------------------------------------
   TONE DETECTION
--------------------------------------------------------- */

function detectTone(message: string): string {
  const msg = message.toLowerCase();

  if (msg.includes("i'm stuck") || msg.includes("i feel lost"))
    return "low_clarity";

  if (msg.includes("urgent") || msg.includes("asap"))
    return "high_urgency";

  if (msg.includes("i'm tired") || msg.includes("burned out"))
    return "fatigue";

  if (msg.includes("let's go") || msg.includes("i'm locked in"))
    return "high_momentum";

  return "neutral";
}

/* ---------------------------------------------------------
   OPERATOR DRIFT DETECTION
--------------------------------------------------------- */

function detectOperatorDrift(
  message: string,
  operator: OperatorType
): string | null {
  const msg = message.toLowerCase();

  if (operator === "athlete" && msg.includes("client"))
    return "business_shift";

  if (operator === "business" && msg.includes("training"))
    return "athlete_shift";

  if (operator === "identity" && msg.includes("schedule"))
    return "scheduling_shift";

  return null;
}

/* ---------------------------------------------------------
   ENGINE PERFORMANCE EVALUATION
--------------------------------------------------------- */

function evaluateEnginePerformance(response: string): string {
  const length = response.length;

  if (length < 50) return "too_short";
  if (length > 2000) return "too_long";

  const hasStructure =
    response.includes("-") ||
    response.includes("•") ||
    response.includes("\n");

  return hasStructure ? "structured" : "unstructured";
}

/* ---------------------------------------------------------
   UPGRADE ACTION GENERATOR
--------------------------------------------------------- */

function buildUpgradeActions(data: {
  operator: OperatorType;
  engine: string;
  tone: string;
  drift: string | null;
  performance: string;
}): string[] {
  const actions: string[] = [];

  if (data.tone === "low_clarity")
    actions.push("Increase directive clarity + reduce ambiguity.");

  if (data.tone === "high_urgency")
    actions.push("Prioritize speed over depth for next response.");

  if (data.tone === "fatigue")
    actions.push("Lower cognitive load + simplify tasks.");

  if (data.tone === "high_momentum")
    actions.push("Increase intensity + challenge level.");

  if (data.drift)
    actions.push(`Prepare to switch operator domain: ${data.drift}.`);

  if (data.performance === "too_short")
    actions.push("Increase depth + expand reasoning.");

  if (data.performance === "too_long")
    actions.push("Condense + tighten future responses.");

  if (data.performance === "unstructured")
    actions.push("Add structure + bullet points for clarity.");

  return actions;
}
