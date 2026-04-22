// aurelius/repositories/logRepository.ts

import { db } from "../core/db/prisma.ts";

export async function createLogEntry({
  operatorId,
  type,
  level,
  message,
  context,
}: {
  operatorId: string;
  type: string;
  level: string;
  message: string;
  context?: any;
}) {
  return db.logEntry.create({
    data: {
      operatorId,
      type,
      level,
      message,
      context,
    },
  });
}
