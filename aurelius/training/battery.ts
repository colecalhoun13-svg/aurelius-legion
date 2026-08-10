// aurelius/training/battery.ts
//
// COLE'S TEST BATTERY — the numbers he actually tracks, named by him
// (2026-08-09): "10 · 5-10-5 · vert · broad · top speed · trap bar 3RM ·
// sometimes squat 3RM". First-class so a testing day is ONE entry pass, the
// athlete card leads with these, and the record wall ranks them. Labels are
// canonical here; logMetric's case-insensitive grouping still absorbs
// variants typed by hand. Direction comes from the same lowerIsBetter the PR
// detector uses — times fall, everything else climbs.

import { prisma } from "../core/db/prisma.ts";
import { logMetric, lowerIsBetter } from "../crm/retention.ts";

export type BatteryTest = { label: string; unit: string; hint: string; optional?: boolean };

/** The canonical battery, in testing order. */
export const BATTERY: BatteryTest[] = [
  { label: "10-yard dash", unit: "s", hint: "10" },
  { label: "5-10-5", unit: "s", hint: "pro agility" },
  { label: "vertical jump", unit: "in", hint: "vert" },
  { label: "broad jump", unit: "in", hint: "broad" },
  { label: "top speed", unit: "mph", hint: "top speed" },
  { label: "trap bar 3RM", unit: "lbs", hint: "trap bar" },
  { label: "squat 3RM", unit: "lbs", hint: "sometimes", optional: true },
];

export type BatteryEntry = { label: string; value: number; unit?: string };
export type BatteryResult = { label: string; ok: boolean; isPR: boolean; error?: string };

/** Log a testing day in one pass. Blanks are simply not sent; each metric
 *  still runs the full PR/target machinery individually. */
export async function logBattery(clientId: string, entries: BatteryEntry[]): Promise<{ results: BatteryResult[]; prCount: number }> {
  if (!entries.length) throw new Error("A battery log needs at least one number.");
  const client = await prisma.client.findUnique({ where: { id: clientId }, select: { id: true } });
  if (!client) throw new Error("No client with that id.");
  const results: BatteryResult[] = [];
  for (const e of entries) {
    const label = (e.label ?? "").trim();
    if (!label || !Number.isFinite(e.value)) {
      results.push({ label: label || "(blank)", ok: false, isPR: false, error: "needs a label and a number" });
      continue;
    }
    try {
      const out = await logMetric({ clientId, label, value: e.value, unit: e.unit?.trim() || undefined, source: "coach" });
      results.push({ label, ok: true, isPR: out.isPR });
    } catch (err: any) {
      results.push({ label, ok: false, isPR: false, error: String(err?.message ?? err).slice(0, 120) });
    }
  }
  return { results, prCount: results.filter((r) => r.isPR).length };
}

export type BatteryRecord = {
  label: string;
  unit: string;
  holder: string | null; // null = no one has a mark yet — an honest empty slot
  value: number | null;
  achievedAt: Date | null;
};

/** The record wall: the best mark on the roster for each battery test. One
 *  slot per test, empty slots stay visible — a record wall with blank lines
 *  is an invitation, a hidden one is nothing. */
export async function batteryRecords(): Promise<BatteryRecord[]> {
  const out: BatteryRecord[] = [];
  for (const test of BATTERY) {
    const best = await prisma.metric.findFirst({
      where: { label: { equals: test.label, mode: "insensitive" } },
      orderBy: { value: lowerIsBetter(test.label) ? "asc" : "desc" },
      select: { value: true, achievedAt: true, client: { select: { name: true } } },
    });
    out.push({
      label: test.label,
      unit: test.unit,
      holder: best?.client.name ?? null,
      value: best?.value ?? null,
      achievedAt: best?.achievedAt ?? null,
    });
  }
  return out;
}
