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
