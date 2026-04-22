/**
 * autonomy/types.ts
 * Aurelius OS v3.4 — Autonomy types (Phase 3)
 */

export type AutonomyGoalStatus = "pending" | "active" | "completed" | "dropped";

export type AutonomyGoalPriority = "low" | "normal" | "high";

export type AutonomyGoal = {
  id: string;
  description: string;
  status: AutonomyGoalStatus;
  priority: AutonomyGoalPriority;
  createdAt: string;
  updatedAt: string;
};

export type AutonomyLoopPhase =
  | "perception"
  | "planning"
  | "action"
  | "reflection";

export type AutonomyLoopStep = {
  id: string;
  timestamp: string;
  phase: AutonomyLoopPhase;
  description: string;
  metadata?: Record<string, any>;
};

export type AutonomyState = {
  currentGoal?: AutonomyGoal;
  goals: AutonomyGoal[];
  history: AutonomyLoopStep[];
};
