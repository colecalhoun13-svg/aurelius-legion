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
      // Bounded: message is btree-indexed (hot-table migration) and Postgres
      // rejects index rows past ~2700 bytes — a future long-message writer
      // must degrade to truncation, never a throwing INSERT (post-sweep).
      message: message.length > 1000 ? message.slice(0, 1000) + "…" : message,
      context,
    },
  });
}
