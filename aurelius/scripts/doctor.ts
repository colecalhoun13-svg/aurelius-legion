// What's actually working on THIS machine, right now.
//
//   cd aurelius && npx tsx scripts/doctor.ts
//
// Live-probes every provider and integration (a key that's set but rejected
// reports as BROKEN, not "configured"), and prints the fix beside each
// failure. Exits 1 when something is broken, so it can gate a deploy.

import { runDoctor, formatDoctor } from "../core/doctor.ts";

// Which failures should actually STOP a deploy. An unfunded xAI account is a
// real red X and an entirely optional tier — gating the pipeline on it would
// teach everyone to ignore the exit code, which is worse than not having one.
const BLOCKING_AREAS = new Set(["core", "engines", "retrieval"]);

async function main() {
  const result = await runDoctor();
  console.log(formatDoctor(result));
  const failures = result.checks.filter((c) => c.status === "fail");
  const blocking = failures.filter((c) => BLOCKING_AREAS.has(c.area));
  const optional = failures.filter((c) => !BLOCKING_AREAS.has(c.area));
  if (optional.length) {
    console.log(`\nNot gating on ${optional.length} non-critical failure(s): ${optional.map((c) => c.name).join(", ")}`);
  }
  process.exit(blocking.length ? 1 : 0);
}

main().catch((err) => {
  console.error("[doctor] failed to run:", err);
  process.exit(1);
});
