// aurelius/core/bridge.ts
//
// Surfacing with SALIENCE. Most BridgeSignals are created with a bare
// prisma.bridgeSignal.create and just sit on the Bridge until Cole looks, or wait
// for the next ritual to mention them. surfaceSignal() adds the timing brain: it
// files the signal AND, when it's genuinely salient (urgent × high-leverage, and
// not in quiet hours), pushes it to Cole's phone in the moment. Low-salience
// signals stay quiet on the Bridge — no 3am buzz over an opportunity.
//
// Adopt this at PROACTIVE surfacing points (conflicts, risks, opportunities).
// It's additive — existing create sites keep working untouched.

import { prisma } from "./db/prisma.ts";
import { shouldPushNow } from "./salience.ts";

export type SurfaceSignalInput = {
  kind: string;
  operatorId?: string | null;
  domain?: string | null;
  sourceType: string;
  sourceId?: string | null;
  severity?: string;
  title: string;
  body: string;
  actions?: any;
  status?: string;
  dueAt?: Date | string | null; // when the underlying thing happens (feeds urgency)
};

export async function surfaceSignal(input: SurfaceSignalInput): Promise<{ id: string; pushed: boolean }> {
  const { dueAt, ...data } = input;
  const signal = await prisma.bridgeSignal.create({
    data: {
      kind: data.kind,
      operatorId: data.operatorId ?? null,
      domain: data.domain ?? null,
      sourceType: data.sourceType,
      sourceId: data.sourceId ?? null,
      severity: data.severity ?? "info",
      title: data.title,
      body: data.body,
      actions: data.actions ?? undefined,
      ...(data.status ? { status: data.status } : {}),
    },
  });

  let pushed = false;
  if (shouldPushNow({ kind: signal.kind, severity: signal.severity, domain: signal.domain, dueAt })) {
    try {
      const { sendToCole } = await import("../telegram/bot.ts");
      pushed = await sendToCole(`${signal.title}\n\n${signal.body}`.slice(0, 3500));
    } catch (err) {
      console.warn("[bridge] salient push failed (signal still filed):", (err as any)?.message ?? err);
    }
  }
  return { id: signal.id, pushed };
}
