// aurelius/scripts/runNervousSystemLoop.ts

import { runNervousSystemTick } from "../core/nervousSystem.ts";

const INTERVAL_SECONDS = 60; // adjust as needed

async function loop() {
  console.log(
    `[NervousSystem] Starting loop with interval ${INTERVAL_SECONDS}s`
  );

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const started = new Date();
    console.log(
      `[NervousSystem] Tick started at ${started.toISOString()}`
    );

    try {
      const result = await runNervousSystemTick();
      console.log(
        `[NervousSystem] Tick completed — evaluated ${result.operatorsEvaluated}, executed ${result.operatorsExecuted}`
      );
    } catch (err) {
      console.error("[NervousSystem] Tick error:", err);
    }

    await new Promise((resolve) =>
      setTimeout(resolve, INTERVAL_SECONDS * 1000)
    );
  }
}

loop().catch((err) => {
  console.error("[NervousSystem] Fatal error:", err);
  process.exit(1);
});
