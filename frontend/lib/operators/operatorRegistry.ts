// ================================
// AURELIUS OS — NAVIGATION REGISTRY
// The 2026-08 ELEVATED IMPERIAL ruling (docs/REDESIGN_PLAN.md): ten tabs —
// Morning · Chat · Decisions · Business · Athletes · Goals · Brain ·
// Calendar · Machine · Tuning. Machine and Tuning point at the
// pages that hold their content TODAY (/engines and /aurelius); when the real
// Machine/Tuning pages land, only the paths change. Nothing is deleted:
// /tools and /settings stay listed under Setup so every live route keeps a
// door on desktop, and /more still lists everything on the phone.
// (Mobile keeps its own five; MobileTabBar is deliberately independent.)
// Standing rules: keep it tight (≤13 items in ≤5 groups); a new page joins an
// existing group or replaces an item. Anything Cole acts on weekly lives here.
// "Zero" (Athlete Zero) joins The day — Cole's own readiness is a daily glance.
// ================================

export type OperatorDefinition = {
  name: string;
  path: string;
  description?: string;
  group: string;
};

export const operatorRegistry: Record<string, OperatorDefinition> = {
  home: {
    name: "Morning",
    path: "/home",
    description: "The day, what needs you, and the confrontation — one screen",
    group: "The day",
  },
  chat: {
    name: "Chat",
    path: "/chat",
    description: "One box, the whole mind — the room itself",
    group: "The day",
  },
  decisions: {
    name: "Decisions",
    path: "/decisions",
    description: "Everything awaiting your ruling — one queue, one badge",
    group: "The day",
  },
  zero: {
    name: "Zero",
    path: "/zero",
    description: "Athlete Zero — your own readiness, numbers, and trajectory",
    group: "The day",
  },
  business: {
    name: "Business",
    path: "/business",
    description: "The remote coaching business — leads, clients, and the money",
    group: "Direction",
  },
  athletes: {
    name: "Athletes",
    path: "/athletes",
    description: "Every athlete against the standard — the radar and the ledger of bests",
    group: "Direction",
  },
  goals: {
    name: "Goals",
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
  calendar: {
    name: "Calendar",
    path: "/calendar",
    description: "The week as a resource",
    group: "Direction",
  },
  machine: {
    name: "Machine",
    path: "/engines",
    description: "Which minds answer which calls — the engine room",
    group: "The machine",
  },
  tuning: {
    name: "Tuning",
    path: "/aurelius",
    description: "Missions, the autonomy dial, and traces — the trust story",
    group: "The machine",
  },
  tools: {
    name: "Tools",
    path: "/tools",
    description: "Integrations and what unlocks them",
    group: "Setup",
  },
  settings: {
    name: "Settings",
    path: "/settings",
    description: "Connections and preferences",
    group: "Setup",
  },
};
