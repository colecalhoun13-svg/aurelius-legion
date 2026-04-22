// aurelius/repositories/autonomyGoalRepository.ts

import { db } from "../core/db/prisma.ts";

export type AutonomyGoalInput = {
  operatorId: string;
  description: string;
  status?: string;
  priority?: string;
};

export async function createAutonomyGoal(input: AutonomyGoalInput) {
  return db.autonomyGoal.create({
    data: {
      operatorId: input.operatorId,
      description: input.description,
      status: input.status ?? "pending",
      priority: input.priority ?? "normal",
    },
  });
}

export async function listActiveAutonomyGoals(operatorId: string) {
  return db.autonomyGoal.findMany({
    where: {
      operatorId,
      status: { in: ["pending", "in_progress"] },
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function updateAutonomyGoalStatus(
  id: string,
  status: string
) {
  return db.autonomyGoal.update({
    where: { id },
    data: { status },
  });
}
