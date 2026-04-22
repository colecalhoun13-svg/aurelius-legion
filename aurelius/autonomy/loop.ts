/**
 * autonomy/loop.ts
 * Aurelius OS v3.4 — Autonomy loop (Hybrid, Phase 3)
 */

import { AutonomyState, AutonomyLoopStep, AutonomyGoal } from "./types";
import crypto from "crypto";

type MinimalEngineContext = {
  requestId: string;
  operatorId: string;
  timestamp: string;
};

function newId() {
  return crypto.randomUUID();
}

function now() {
  return new Date().toISOString();
}

function pushStep(
  state: AutonomyState,
  phase: AutonomyLoopStep["phase"],
  description: string,
  metadata?: Record<string, any>
): AutonomyState {
  const step: AutonomyLoopStep = {
    id: newId(),
    timestamp: now(),
    phase,
    description,
    metadata
  };
  return {
    ...state,
    history: [...state.history, step]
  };
}

function ensureGoal(state: AutonomyState): AutonomyState {
  if (state.currentGoal) return state;

  const goal: AutonomyGoal = {
    id: newId(),
    description: "Maintain system awareness and prepare for operator missions.",
    status: "active",
    priority: "normal",
    createdAt: now(),
    updatedAt: now()
  };

  return {
    ...state,
    currentGoal: goal,
    goals: [...state.goals, goal]
  };
}

export async function runAutonomyLoop(
  state: AutonomyState,
  ctx: MinimalEngineContext
): Promise<AutonomyState> {
  let next = { ...state };

  // Perception
  next = pushStep(next, "perception", "Read current goal and system context.", {
    requestId: ctx.requestId,
    operatorId: ctx.operatorId
  });

  next = ensureGoal(next);

  // Planning (Hybrid: placeholder for future LLM planning)
  next = pushStep(
    next,
    "planning",
    "Plan next small step toward current goal.",
    {
      goalId: next.currentGoal?.id,
      goalDescription: next.currentGoal?.description
    }
  );

  // Action (Phase 3: log intent; Phase 5+ will call engines)
  next = pushStep(next, "action", "Record planned action for future execution.", {
    plannedAction: "Prepare to create or update tasks in task engine."
  });

  // Reflection (Hybrid: placeholder for future LLM reflection)
  next = pushStep(next, "reflection", "Reflect on loop and update timestamps.", {
    loopCompletedAt: now()
  });

  if (next.currentGoal) {
    next.currentGoal = {
      ...next.currentGoal,
      updatedAt: now()
    };
  }

  return next;
}
