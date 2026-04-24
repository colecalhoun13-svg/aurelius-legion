// scripts/smokePhase4.ts
// Aurelius OS v3.4 — Phase 4 smoke test

import { db } from "../core/db/prisma.ts";
import { writeMemory, readMemory } from "../core/memoryEngine.ts";
import { createTask } from "../repositories/taskRepository.ts";
import { writeLog } from "../repositories/logRepository.ts";

async function main() {
  // Use any existing operator name or ID; adjust as needed
  const operator = await db.operator.findFirst();
  if (!operator) {
    throw new Error("No Operator found. Run seedOperators first.");
  }

  console.log("Using operator:", operator.id, operator.name);

  await writeMemory(operator.id, {
    testNote: "Phase 4 smoke test memory entry",
  });

  const mem = await readMemory(operator.id);
  console.log("Memory count:", mem.length);

  const task = await createTask({
    operatorId: operator.id,
    title: "Phase 4 smoke test task",
    status: "created",
    metadata: { source: "smokePhase4" },
  });
  console.log("Created task:", task.id);

  const log = await writeLog({
    operatorId: operator.id,
    type: "smoke",
    level: "info",
    message: "Phase 4 smoke test log entry",
    context: { taskId: task.id },
  });
  console.log("Created log:", log.id);

  console.log("Phase 4 smoke test complete.");
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
