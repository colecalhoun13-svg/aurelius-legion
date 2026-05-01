import { prisma } from "../core/db/prisma.ts";

async function main() {
  const memories = await prisma.memory.findMany({
    include: { operator: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  console.log(`Found ${memories.length} memories (most recent 20):`);
  for (const m of memories) {
    const meta = m.metadata as any;
    const related = Array.isArray(meta?.relatedOperators)
      ? ` (+ related: ${meta.relatedOperators.join(", ")})`
      : "";
    console.log(`  [${m.operator.name}] ${m.category}: ${m.value}${related}`);
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});