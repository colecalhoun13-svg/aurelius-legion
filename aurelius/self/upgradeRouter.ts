// aurelius/self/upgradeRouter.ts
/**
 * Upgrade Router — Aurelius OS v3.4
 * Exposes self-upgrade engine for API routes or CLI.
 */

import { runSelfUpgrade } from "./selfUpgradeEngine.ts";

export async function upgradeAurelius() {
  return await runSelfUpgrade();
}
