// aurelius/scripts/runNervousSystemTick.ts

import { runNervousSystemTick } from "../core/nervousSystem.ts";

async function main() {
  const result = await runNervousSystemTick();
  console.log("Nervous system tick result:");
  console.dir(result, { depth: null });
}

main().catch((err) => {
  console.error("Error running nervous system tick:", err);
  process.exit(1);
});
