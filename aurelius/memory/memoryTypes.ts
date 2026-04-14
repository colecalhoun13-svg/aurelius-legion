// aurelius/memory/memoryTypes.ts
/**
 * Memory schema for Aurelius OS v3.4
 */

export type UserProfile = {
  name: string;
  identity: string[];
  roles: string[];
  createdAt: string;
  updatedAt: string;
};

export type UserGoals = {
  shortTerm: string[];
  mediumTerm: string[];
  longTerm: string[];
  updatedAt: string;
};

export type UserPreferences = {
  communicationStyle: string;
  trainingStyle: string;
  businessStyle: string;
  constraints: string[];
  updatedAt: string;
};

export type UserConstraints = {
  time: string[];
  energy: string[];
  schedule: string[];
  physical: string[];
  financial: string[];
  updatedAt: string;
};

export type UserHistory = {
  daily: string[];
  weekly: string[];
  research: string[];
  tasks: string[];
  updatedAt: string;
};

export type SystemMemory = {
  lastDailyRun: string | null;
  lastWeeklyRun: string | null;
  operatorUsage: Record<string, number>;
  updatedAt: string;
};
