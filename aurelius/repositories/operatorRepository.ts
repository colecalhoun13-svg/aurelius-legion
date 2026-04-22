// aurelius/repositories/operatorRepository.ts

import { db } from "../core/db/prisma.ts";

export type OperatorMode = "idle" | "normal" | "focus" | "aggressive";

export type OperatorRecord = {
  id: string;
  name: string;
  domain: string | null;
  priority: number | null;
  cooldownSeconds: number | null;
  lastRunAt: Date | null;
  mode: OperatorMode;
};

export async function listAllOperators(): Promise<OperatorRecord[]> {
  const operators = await db.operator.findMany({
    orderBy: { name: "asc" },
  });

  return operators.map((op) => ({
    id: op.id,
    name: op.name,
    domain: (op as any).domain ?? null,
    priority: (op as any).priority ?? 1,
    cooldownSeconds: (op as any).cooldownSeconds ?? 60,
    lastRunAt: (op as any).lastRunAt ?? null,
    mode: ((op as any).mode as OperatorMode) ?? "normal",
  }));
}

export async function updateOperatorLastRun(
  operatorId: string,
  date: Date
) {
  return db.operator.update({
    where: { id: operatorId },
    data: {
      lastRunAt: date,
    },
  });
}

export async function updateOperatorMode(
  operatorId: string,
  mode: OperatorMode
) {
  return db.operator.update({
    where: { id: operatorId },
    data: {
      mode,
    },
  });
}
