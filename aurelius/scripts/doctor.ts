// What's actually working on THIS machine, right now.
//
//   cd aurelius && npx tsx scripts/doctor.ts
//
// Live-probes every provider and integration (a key that's set but rejected
// reports as BROKEN, not "configured"), and prints the fix beside each
// failure. Exits 1 when something is broken, so it can gate a deploy.

import { runDoctor, formatDoctor } from "../core/doctor.ts";

async function main() {
  const result = await runDoctor();
  console.log(formatDoctor(result));
  process.exit(result.checks.some((c) => c.status === "fail") ? 1 : 0);
}

main().catch((err) => {
  console.error("[doctor] failed to run:", err);
  process.exit(1);
});
