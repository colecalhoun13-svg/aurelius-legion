// aurelius/repositories/autonomyRepository.ts

import { db } from "../core/db/prisma.ts";

export async function createAutonomyRecord({
  operatorId,
  eventType,
  detail,
  context,
}: {
  operatorId: string;
  eventType: string;
  detail: string;
  context?: any;
}) {
  return db.autonomyGoal.create({
    data: {
      operatorId,
      description: detail,
      status: "completed",
      priority: "normal",
    },
  });
}

export async function listAutonomyRecords(operatorId: string) {
  return db.autonomyGoal.findMany({
    where: { operatorId },
    orderBy: { createdAt: "desc" },
  });
}

export async function deleteAutonomyRecord(id: string) {
  return db.autonomyGoal.delete({
    where: { id },
  });
}
