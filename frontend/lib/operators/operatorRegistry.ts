// ================================
// AURELIUS OS — NAVIGATION REGISTRY
// The 2026-08 ELEVATED IMPERIAL ruling (docs/REDESIGN_PLAN.md), reorganized
// 2026-08-13 into five coherent groups so the nav reads as designed, not
// accreted:
//   The day  — Dashboard · Chat · Decisions   (what you look at every day)
//   You      — Zero · Finance                 (your body + your money, private)
//   Direction— Business · Athletes · Goals · Calendar · Brain   (the work)
//   The machine — Machine · Tuning            (how Aurelius runs)
//   Setup    — Tools · Settings
// Machine/Tuning point at the pages that hold their content TODAY (/engines,
// /aurelius); when the real pages land, only the paths change. Nothing is
// deleted; /more still lists everything on the phone. Standing rule: each
// label means ONE thing, ≤5 groups; a new page joins a group by theme, and
// the group ORDER here is the render order (first-seen wins).
// ================================

export type OperatorDefinition = {
  name: string;
  path: string;
  description?: string;
  group: string;
};

export const operatorRegistry: Record<string, OperatorDefinition> = {
  home: {
    name: "Dashboard",
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
    group: "You",
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
  finance: {
    name: "Finance",
    path: "/finance",
    description: "Your personal money — net worth, cashflow, and runway (private)",
    group: "You",
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
