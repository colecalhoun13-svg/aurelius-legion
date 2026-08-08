// aurelius/crm/onboarding.ts
//
// THE CLIENT ONBOARDING RUNWAY — the first 14 days, laid down at conversion.
//
// A signed client with no plan for week one is how a coaching relationship
// starts cold: the welcome message goes out late, the intake questions never
// go out, and the program arrives "whenever". Cole ran this on memory; memory
// is what this replaces. When convertLead fires, this lays five Task rows —
// day 0 through day 14 — so the runway exists the moment the client does.
//
// Everything here is INWARD (NORTH_STAR §2.5): plain task creation plus one
// receipt on the Bridge. Nothing sends, nothing schedules on anyone else's
// calendar, no grant is needed and none is checked — creating a task on
// Cole's own list is exactly as reversible as deleting it. The runway fires
// only on a REAL conversion (convertLead throws on a re-convert, so it can
// never double-lay), and it is guarded here too so a retried call can't
// duplicate the tasks.

import { prisma } from "../core/db/prisma.ts";
import { createTask } from "../productivity/service.ts";
import { surfaceSignal } from "../core/bridge.ts";

/** Days offset → a concrete date at 09:00 local (the runway speaks in days,
 *  tasks want datetimes; 9am is when Cole can actually act on them). */
function onDay(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(9, 0, 0, 0);
  return d;
}

export const RUNWAY_STEP_COUNT = 5;

/**
 * Lay the first-14-days runway for a freshly converted client.
 *
 * Five steps, per Cole's actual delivery shape (Sheets-based programs):
 *   day 0  — draft the welcome message
 *   day 1  — send the intake questions
 *   day 3  — program sheet delivered (the deadline that defines "onboarded")
 *   day 7  — first check-in
 *   day 14 — review: are they getting what they paid for?
 *
 * Also sets checkInEveryDays=7 when unset, so the retention sweep has a
 * cadence to work from without Cole having to remember to configure one.
 *
 * Best-effort by contract: the caller (convertLead) treats a failure here as
 * non-fatal — a missing runway must never roll back a real conversion.
 */
export async function layOnboardingRunway(client: {
  id: string;
  name: string;
  checkInEveryDays?: number | null;
}): Promise<{ ok: boolean; created: number; note: string }> {
  // Guard: the runway is laid once per client, ever. convertLead already
  // can't re-fire, but a retried tool call or a manual invocation shouldn't
  // stack a second set of identical tasks on Cole's list.
  const already = await prisma.task.findFirst({
    where: { originContext: { path: ["runwayClientId"], equals: client.id } },
    select: { id: true },
  });
  if (already) {
    return { ok: true, created: 0, note: `Onboarding runway already laid for ${client.name}.` };
  }

  const name = client.name;
  const originContext = { reason: "onboarding_runway", runwayClientId: client.id };
  const steps: Array<{ title: string; description: string; day: number; status: string; priority?: string; scheduled?: boolean }> = [
    {
      title: `Draft the welcome message to ${name}`,
      description: "Day 0 of onboarding — what to expect, when the program lands, how check-ins work. Your words, your send.",
      day: 0,
      status: "today",
    },
    {
      title: `Send ${name} the intake questions`,
      description: "Day 1 — training history, schedule, equipment, injuries, the goal in their words. The program is only as good as this.",
      day: 1,
      status: "next",
    },
    {
      title: `Program sheet to ${name}`,
      description: "Day 3 deadline — build the program in Sheets and deliver it. This is the moment they become a coached athlete instead of a signed name.",
      day: 3,
      status: "next",
      priority: "high",
    },
    {
      title: `First check-in with ${name}`,
      description: "Day 7 — how did week one actually go? Log it as a session so the retention clock starts from reality.",
      day: 7,
      status: "next",
      scheduled: true,
    },
    {
      title: `Day-14 review: is ${name} getting what they paid for?`,
      description: "Two weeks in — adherence, first numbers, anything to adjust. The honest question, asked early enough to fix.",
      day: 14,
      status: "next",
    },
  ];

  let created = 0;
  for (const s of steps) {
    await createTask({
      title: s.title,
      description: s.description,
      domain: "business",
      status: s.status,
      priority: s.priority ?? "normal",
      dueDate: onDay(s.day).toISOString(),
      ...(s.scheduled ? { scheduledFor: onDay(s.day).toISOString() } : {}),
      origin: "aurelius_proposed",
      originContext,
    });
    created++;
  }

  // Retention cadence default — a client with no cadence is a client the
  // retention sweep can never notice going quiet. Only when unset: a value
  // Cole chose is his.
  if (client.checkInEveryDays == null) {
    await prisma.client
      .update({ where: { id: client.id }, data: { checkInEveryDays: 7 } })
      .catch(() => {});
  }

  // The receipt — a "noted" row on the Bridge, never a pending decision:
  // this reports work done on Cole's own list, it asks nothing of him.
  await surfaceSignal({
    kind: "background_result",
    domain: "business",
    sourceType: "onboarding_runway",
    sourceId: `onboarding:${client.id}`,
    severity: "info",
    title: `Onboarding runway laid for ${name} — 5 steps over 14 days`,
    body:
      `Day 0 welcome draft · day 1 intake questions · day 3 program sheet (deadline) · day 7 first check-in · day 14 review.\n\n` +
      `All inward — five tasks on your list plus a check-in cadence default (every 7 days). Nothing was sent to ${name}.`,
  }).catch(() => {});

  return { ok: true, created, note: `Onboarding runway laid for ${name} — ${created} steps over 14 days.` };
}
