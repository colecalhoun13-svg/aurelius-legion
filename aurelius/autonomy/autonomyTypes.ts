// aurelius/autonomy/autonomyTypes.ts

export type AutonomyContext = {
  operator: string;
  goal: string;
  history: AutonomyEvent[];
};

export type AutonomyEvent = {
  type: "decision" | "task" | "reflection";
  timestamp: string;
  detail: string;
};

export type Decision = {
  action: "research" | "upgrade" | "plan" | "reflect" | "none";
  reason: string;
};

export type PlannedTask = {
  steps: string[];
  confidence: number;
};

export type Reflection = {
  insights: string[];
  confidence: number;
};
