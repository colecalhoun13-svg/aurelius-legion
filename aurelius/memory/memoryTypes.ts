// aurelius/memory/memoryTypes.ts

export type UserProfile = {
  name?: string;
  roles?: string[];
  bio?: string;
};

export type UserGoals = {
  life?: string[];
  business?: string[];
  training?: string[];
  wealth?: string[];
};

export type UserConstraints = {
  time?: string[];
  energy?: string[];
  money?: string[];
  ethics?: string[];
};

export type UserPreferences = {
  style?: string[];
  tools?: string[];
  communication?: string[];
};

export type UserHistory = {
  events?: string[];
};

export type SystemMemory = {
  insights?: string[];
  recentWrites?: MemoryWrite[];
};

export type MemoryWrite = {
  id: string;
  timestamp: string;
  domain: string;
  source: string;
  summary: string;
};

export type FullMemory = {
  profile: UserProfile;
  goals: UserGoals;
  constraints: UserConstraints;
  preferences: UserPreferences;
  history: UserHistory;
  system: SystemMemory;
};
