// aurelius/crm/targets.ts
//
// TARGETS — a trend's destination. Cole sets "squat 315 by November"; pace is
// derived at read time (crm/performance.ts::targetPace), the crossing is
// stamped the moment a logged metric reaches it, and the Monday trend sweep
// names anyone behind. Training domain throughout — targets apply to BOTH
// kinds of athlete and never touch business machinery.

import { prisma } from "../core/db/prisma.ts";
import { lowerIsBetter } from "./retention.ts";

const key = (label: string, unit?: string | null) =>
  `${label.trim().toLowerCase()}|${(unit ?? "").trim().toLowerCase()}`;

export async function setTarget(input: {
  clientId: string;
  label: string;
  targetValue: number;
  unit?: string | null;
  targetDate?: string | Date | null;
  note?: string | null;
}) {
  const label = (input.label ?? "").trim();
  if (!label) throw new Error("A target needs a label (what's being measured).");
  if (!Number.isFinite(input.targetValue)) throw new Error("A target needs a number.");
  const client = await prisma.client.findUnique({ where: { id: input.clientId }, select: { id: true, name: true } });
  if (!client) throw new Error("No client with that id.");
  const targetDate = input.targetDate ? new Date(input.targetDate) : null;
  if (targetDate && isNaN(targetDate.getTime())) throw new Error("That target date doesn't parse.");

  // One OPEN target per (athlete, measure): re-setting replaces the standing
  // one rather than stacking duplicates. Achieved targets stay as history.
  const openTargets = await prisma.athleteTarget.findMany({ where: { clientId: input.clientId, achievedAt: null } });
  const open = openTargets.find((t) => key(t.label, t.unit) === key(label, input.unit)) ?? null;
  if (open) {
    return prisma.athleteTarget.update({
      where: { id: open.id },
      data: { targetValue: input.targetValue, targetDate, note: input.note?.trim() || null, unit: input.unit?.trim() || null, label },
    });
  }
  return prisma.athleteTarget.create({
    data: {
      clientId: input.clientId,
      label,
      unit: input.unit?.trim() || null,
      targetValue: input.targetValue,
      targetDate,
      note: input.note?.trim() || null,
    },
  });
}

export async function dropTarget(id: string) {
  const t = await prisma.athleteTarget.findUnique({ where: { id }, select: { id: true } });
  if (!t) throw new Error("No such target.");
  await prisma.athleteTarget.delete({ where: { id } });
  return { ok: true };
}

/** Called (fire-and-forget) from logMetric: a new number may cross an open
 *  target. Stamps achievedAt and surfaces a training-domain win — deduped on
 *  the target id, so a crossing celebrates once. */
export async function checkTargetCrossing(clientId: string, label: string, value: number, unit?: string | null): Promise<void> {
  const open = await prisma.athleteTarget.findMany({ where: { clientId, achievedAt: null } });
  const k = key(label, unit);
  const hit = open.find((t) => key(t.label, t.unit) === k);
  if (!hit) return;
  const lower = lowerIsBetter(label);
  const reached = lower ? value <= hit.targetValue : value >= hit.targetValue;
  if (!reached) return;
  await prisma.athleteTarget.update({ where: { id: hit.id }, data: { achievedAt: new Date() } });
  const client = await prisma.client.findUnique({ where: { id: clientId }, select: { name: true } });
  const { surfaceSignal } = await import("../core/bridge.ts");
  await surfaceSignal({
    kind: "background_result",
    domain: "training",
    sourceType: "target_hit",
    sourceId: `target:${hit.id}`,
    severity: "notice",
    title: `${client?.name ?? "An athlete"} hit the target — ${hit.label} ${value}${hit.unit ?? ""} (goal was ${hit.targetValue}${hit.unit ?? ""})`,
    body: `Set ${hit.createdAt.toISOString().slice(0, 10)}${hit.targetDate ? `, due ${hit.targetDate.toISOString().slice(0, 10)}` : ""} — reached today. Worth naming a new target while the momentum's there.`,
  }).catch(() => {});
}
