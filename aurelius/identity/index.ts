// aurelius/identity/index.ts
//
// Single import point for all identity data.
// Used by the system prompt builder to inject identity into every Aurelius response.

import { PROFILE } from "./profile.ts";
import { PREFERENCES } from "./preferences.ts";

export const IDENTITY = {
  profile: PROFILE,
  preferences: PREFERENCES,
};

export { PROFILE, PREFERENCES };