// Seed Cole's stated business facts into Living Knowledge.
//
// Idempotent — an existing entry is never overwritten, because Cole's later
// corrections outrank the seed. Run once per database:
//
//   cd aurelius && DATABASE_URL=<url> npx tsx scripts/seedBusiness.ts
//
// (Railway/Neon: use the Neon URL. The local sandbox gets it via the smoke
// suite, which seeds and asserts the same path.)

import { seedBusinessProfile, businessSnapshot } from "../business/positioning.ts";

async function main() {
  const { written, skipped, revised, retired } = await seedBusinessProfile();
  console.log(`[seedBusiness] wrote ${written.length} fact(s): ${written.join(", ") || "(none)"}`);
  if (revised.length) console.log(`[seedBusiness] revised (Cole restated): ${revised.join(", ")}`);
  if (retired.length) console.log(`[seedBusiness] retired (no longer true): ${retired.join(", ")}`);
  if (skipped.length) console.log(`[seedBusiness] left alone (already known): ${skipped.join(", ")}`);

  const snap = await businessSnapshot();
  console.log(`\n${snap.summary}\n`);
  if (snap.openGaps.length > 0) {
    console.log("Open questions, most-unblocking first:");
    for (const g of snap.openGaps) console.log(`  • [${g.key}] ${g.question}`);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error("[seedBusiness] failed:", err);
  process.exit(1);
});
