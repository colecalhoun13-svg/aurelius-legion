// ================================
// AURELIUS OS — NAVIGATION REGISTRY
// The council's five (+ two until the One Home lands): everything Cole
// does daily is one tap; everything else lives under More. Seventeen flat
// destinations shrank to this on the 2026-07 convergent ruling.
// ================================

export type OperatorDefinition = {
  name: string;
  path: string;
  description?: string;
};

export const operatorRegistry: Record<string, OperatorDefinition> = {
  home: {
    name: "Home",
    path: "/deck",
    description: "The day: greeting, biggest risk, what needs you",
  },
  today: {
    // Folds into Home when the One Home ships (UX-PR5).
    name: "Today",
    path: "/today",
    description: "Plan, tasks, habits, capture",
  },
  chat: {
    // Becomes Home's spine when the One Box ships (UX-PR5/6).
    name: "Chat",
    path: "/",
    description: "Talk to Aurelius",
  },
  decisions: {
    name: "Decisions",
    path: "/decisions",
    description: "Everything awaiting your ruling — one queue, one badge",
  },
  calendar: {
    name: "Calendar",
    path: "/calendar",
    description: "The week as a resource",
  },
  brain: {
    name: "Brain",
    path: "/brain",
    description: "The shelves, ask-anything, and the syntheses",
  },
  more: {
    name: "More",
    path: "/more",
    description: "Goals, Aurelius, autonomy, and the engine room",
  },
};
