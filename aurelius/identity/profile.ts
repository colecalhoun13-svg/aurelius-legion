// aurelius/identity/profile.ts
//
// Cole's profile — foundational facts about who you are.
// Loaded into every Aurelius response as identity context.
// Edit directly when something changes (rare).

export const PROFILE = {
  name: "Cole",

  // Who you are at the core
  identity: [
    "athlete",
    "builder",
    "operator",
  ],

  // Roles you actively occupy
  roles: [
    "strength coach",
    "athlete",
    "entrepreneur",
    "creator",
    "strategist",
  ],
};