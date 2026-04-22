// aurelius/autonomy/taskPlanner.ts

import { PlannedTask } from "./autonomyTypes";
import { getOperatorProfile } from "../core/operatorProfiles"; // adjust path if needed

export function planTask(goal: string, operator: string = "strategy"): PlannedTask {
  const profile = getOperatorProfile(operator);
  const decision = profile?.decisionProfile;
  const autonomy = profile?.autonomyPolicy;

  // --- 1) Determine planning depth -----------------------------------------
  let depth = 3; // default medium depth

  if (decision?.depthBias === "deep") depth = 6;
  if (decision?.depthBias === "medium") depth = 4;
  if (decision?.depthBias === "shallow") depth = 2;

  // urgency modifies depth if allowed
  if (decision?.timeSensitivity === "adaptive") {
    if (/urgent|asap|today/i.test(goal)) depth = Math.max(2, depth - 2);
  }

  // --- 2) Break goal into conceptual chunks --------------------------------
  const words = goal.split(/\s+/).filter(Boolean);
  const chunks = [];

  for (let i = 0; i < depth; i++) {
    const word = words[i] ?? null;

    if (!word) {
      chunks.push(`Step ${i + 1}: Clarify missing detail for this part of the goal.`);
      continue;
    }

    chunks.push(`Step ${i + 1}: ${word.charAt(0).toUpperCase() + word.slice(1)}`);
  }

  // --- 3) Add operator-specific planning behavior ---------------------------
  if (autonomy?.planningBias === "high") {
    chunks.push("Step (extra): Identify constraints, risks, and required resources.");
  }

  // --- 4) Confidence score --------------------------------------------------
  let confidence = 0.7;

  if (decision?.depthBias === "deep") confidence = 0.85;
  if (decision?.depthBias === "shallow") confidence = 0.55;

  return {
    steps: chunks,
    confidence,
  };
}
