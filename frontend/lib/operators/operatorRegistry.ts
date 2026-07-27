// ================================
// AURELIUS OS — NAVIGATION REGISTRY
// The 2026-07 v2 ruling: grouping IS the streamlining. Desktop shows the
// whole map — nine destinations under four whisper-cap headers — because a
// sidebar is a table of contents, not a thumb. (Mobile keeps its own five;
// MobileTabBar is deliberately independent of this registry.)
// Standing rules: at most 12 items in at most 5 groups; a new page joins an
// existing group or replaces an item. Anything Cole acts on weekly lives here.
// ================================

export type OperatorDefinition = {
  name: string;
  path: string;
  description?: string;
  group: string;
};

export const operatorRegistry: Record<string, OperatorDefinition> = {
  home: {
    name: "Home",
    path: "/home",
    description: "The day, what needs you, and the conversation — one screen",
    group: "The day",
  },
  decisions: {
    name: "Decisions",
    path: "/decisions",
    description: "Everything awaiting your ruling — one queue, one badge",
    group: "The day",
  },
  calendar: {
    name: "Calendar",
    path: "/calendar",
    description: "The week as a resource",
    group: "The day",
  },
  goals: {
    name: "Goals & Projects",
    path: "/goals",
    description: "Big and small, with runway — the numbers that must move",
    group: "Direction",
  },
  brain: {
    name: "Brain",
    path: "/brain",
    description: "The shelves, ask-anything, and the syntheses",
    group: "Direction",
  },
  aurelius: {
    name: "Aurelius",
    path: "/aurelius",
    description: "Missions, the autonomy dial, and traces — the trust story",
    group: "Aurelius",
  },
  tools: {
    name: "Tools",
    path: "/tools",
    description: "Integrations and what unlocks them",
    group: "Setup",
  },
  engines: {
    name: "Engines",
    path: "/engines",
    description: "Which minds answer which calls",
    group: "Setup",
  },
  settings: {
    name: "Settings",
    path: "/settings",
    description: "Connections and preferences",
    group: "Setup",
  },
};
