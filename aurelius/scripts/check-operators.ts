import { prisma } from "../core/db/prisma.ts";

async function main() {
  const operators = await prisma.operator.findMany({
    select: { id: true, name: true, domain: true },
    orderBy: { name: "asc" },
  });

  console.log(`Found ${operators.length} operators:`);
  for (const op of operators) {
    console.log(`  - ${op.name} (id: ${op.id})`);
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});