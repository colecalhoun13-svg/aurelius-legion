// aurelius/autonomy/decisionEngine.ts

import { AutonomyContext, Decision } from "./autonomyTypes";
import { getOperatorProfile } from "../core/operatorProfiles"; // adjust path if needed

export function decideNextAction(ctx: AutonomyContext): Decision {
  const { operator, goal, history } = ctx;

  const profile = getOperatorProfile(operator);
  const decision = profile?.decisionProfile;
  const autonomy = profile?.autonomyPolicy;

  // --- 1) No goal → nothing to do -----------------------------------------
  if (!goal || goal.trim().length === 0) {
    return {
      action: "none",
      reason: "No goal provided — cannot determine next action."
    };
  }

  // --- 2) Determine clarity of goal ----------------------------------------
  const isGoalVague =
    goal.length < 12 ||
    /^(improve|fix|work on|figure out|get better)/i.test(goal);

  if (isGoalVague) {
    return {
      action: "research",
      reason: "Goal is vague — research required to clarify direction."
    };
  }

  // --- 3) Look at last event -----------------------------------------------
  const last = history[history.length - 1];

  // No history → start with research or planning depending on operator
  if (!last) {
    if (autonomy?.planningBias === "high") {
      return {
        action: "plan",
        reason: "No prior context — operator prefers planning first."
      };
    }

    return {
      action: "research",
      reason: "No prior context — research needed to establish baseline."
    };
  }

  // --- 4) After a decision → plan ------------------------------------------
  if (last.type === "decision") {
    return {
      action: "plan",
      reason: "A decision was made — next step is structured planning."
    };
  }

  // --- 5) After a task → reflect -------------------------------------------
  if (last.type === "task") {
    if (autonomy?.reflectionBias === "high") {
      return {
        action: "reflect",
        reason: "Task completed — operator prefers deep reflection."
      };
    }

    return {
      action: "plan",
      reason: "Task completed — continue planning next steps."
    };
  }

  // --- 6) After reflection → act or plan -----------------------------------
  if (last.type === "reflection") {
    if (autonomy?.actionBias === "high") {
      return {
        action: "plan",
        reason: "Reflection complete — operator prefers decisive action."
      };
    }

    return {
      action: "research",
      reason: "Reflection complete — gather more insight before acting."
    };
  }

  // --- 7) Fallback ----------------------------------------------------------
  return {
    action: "none",
    reason: "No valid next action determined."
  };
}
