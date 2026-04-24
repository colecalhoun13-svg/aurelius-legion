// scripts/seedOperators.ts

import { db } from "../core/db/prisma.ts";
import { listOperators, getOperator } from "../core/operatorRegistry.ts";

async function main() {
  const operatorNames = listOperators();

  console.log(`Seeding ${operatorNames.length} operators...`);

  for (const name of operatorNames) {
    const profile = getOperator(name);

    await db.operator.upsert({
      where: { name: profile.name },
      update: {},
      create: { name: profile.name },
    });

    console.log(`✓ Seeded operator: ${profile.name}`);
  }

  console.log("Operator seeding complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
