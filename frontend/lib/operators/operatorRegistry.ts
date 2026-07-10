// ================================
// AURELIUS OS 3.4 — OPERATOR REGISTRY
// Defines all operators available in the OS.
// ================================

export type OperatorDefinition = {
  name: string;
  path: string;
  description?: string;
};

export const operatorRegistry: Record<string, OperatorDefinition> = {
  dashboard: {
    name: "Dashboard",
    path: "/",
    description: "Primary operator overview",
  },
  deck: {
    name: "Command Deck",
    path: "/deck",
    description: "The three-lane view — your day, the bridge, Aurelius's work",
  },
  today: {
    name: "Today",
    path: "/today",
    description: "Cole's lane — today's plan, tasks, habits, capture",
  },
  projects: {
    name: "Projects",
    path: "/projects",
    description: "Progress, runway, and what each project needs",
  },
  goals: {
    name: "Goals",
    path: "/goals",
    description: "Big and small, by horizon",
  },
  bridge: {
    name: "Bridge",
    path: "/bridge",
    description: "Signals from Aurelius's background work",
  },
  aurelius: {
    name: "Aurelius",
    path: "/aurelius",
    description: "What the system is doing in the background",
  },
  corpus: {
    name: "Corpus",
    path: "/corpus",
    description: "Knowledge ingestion, preview, and management",
  },
  engines: {
    name: "Engines",
    path: "/engines",
    description: "Model engines, routing, and intelligence modules",
  },
  settings: {
    name: "Settings",
    path: "/settings",
    description: "System configuration and operator preferences",
  },
};
