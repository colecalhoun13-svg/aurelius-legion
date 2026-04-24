// repositories/taskRepository.ts
// Aurelius OS v3.4 — Task repository (DB-backed)

import { db } from "../core/db/prisma.ts";
import type { Task } from "@prisma/client";

export async function createTask(params: {
  operatorId: string;
  title: string;
  status?: string;
  metadata?: any;
}): Promise<Task> {
  const { operatorId, title, status = "created", metadata } = params;

  return db.task.create({
    data: {
      operatorId,
      title,
      status,
      metadata,
    },
  });
}

export async function updateTaskStatus(id: string, status: string): Promise<Task> {
  return db.task.update({
    where: { id },
    data: { status },
  });
}
