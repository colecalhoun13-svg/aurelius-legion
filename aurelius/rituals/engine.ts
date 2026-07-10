// aurelius/rituals/engine.ts
//
// RITUALS — the push. Aurelius doesn't wait to be asked; the day is
// bracketed by a morning briefing and a nightly debrief, both written
// in the persona voice from real state (plan, tasks, habits, calendar,
// signals, goals). Ritual-first: these earn the interruption.
//
// Structure: facts are assembled deterministically, ALWAYS. The LLM
// adds the voice on top. If no engine is configured, the deterministic
// briefing ships anyway — a ritual never fails to fire for lack of a key.

import { prisma } from "../core/db/prisma.ts";
import { runLLM } from "../llm/runLLM.ts";
import { getToday } from "../productivity/service.ts";
import { runNightlyPulse } from "../autonomy/pulse.ts";

const RITUAL_DEFS = [
  { name: "morning_briefing", cadence: "daily_morning", scheduledTime: "07:00" },
  { name: "nightly_debrief", cadence: "daily_night", scheduledTime: "21:30" },
  { name: "weekly_planning", cadence: "weekly_sunday", scheduledTime: "sunday_09:00" },
];

export async function ensureRituals() {
  for (const def of RITUAL_DEFS) {
    await prisma.ritual.upsert({
      where: { name: def.name },
      update: {},
      create: def,
    });
  }
}

// LLM text that indicates no engine answered (keyless environment).
function isEngineUnavailable(text: string): boolean {
  return /engine is not configured|Missing .*_API_KEY/i.test(text);
}

async function voiceOver(skeleton: string, instruction: string): Promise<string> {
  try {
    const response = await runLLM({
      taskType: "chat",
      operators: { primary: "strategy", secondaries: [] },
      input: `${instruction}\n\n═══ TODAY'S GROUND TRUTH ═══\n${skeleton}`,
    });
    if (!isEngineUnavailable(response.text)) return response.text;
  } catch (err) {
    console.warn("[rituals] voice-over failed, shipping deterministic briefing:", err);
  }
  return skeleton;
}

async function fileInstance(ritualName: string, outputText: string, structured?: any) {
  let ritual = await prisma.ritual.findUnique({ where: { name: ritualName } });
  if (!ritual) {
    // Callers outside the server process (Next API routes, CLI) may hit
    // this before index.ts has seeded — self-heal instead of throwing.
    await ensureRituals();
    ritual = await prisma.ritual.findUniqueOrThrow({ where: { name: ritualName } });
  }

  const instance = await prisma.ritualInstance.create({
    data: {
      ritualId: ritual.id,
      scheduledFor: new Date(),
      firedAt: new Date(),
      status: "generated",
      outputText,
      outputStructured: structured ?? undefined,
      deliveredVia: "in_app",
    },
  });

  await prisma.bridgeSignal.create({
    data: {
      kind: "background_result",
      domain: "personal",
      sourceType: "ritual",
      sourceId: instance.id,
      severity: "notice",
      title: ritualName === "morning_briefing" ? "Morning briefing" : "Nightly debrief",
      body: outputText.slice(0, 1500),
    },
  });

  return instance;
}

// ── Morning briefing ─────────────────────────────────────────────────

export async function generateMorningBriefing(dateStr?: string) {
  const today = await getToday(dateStr);

  const lines: string[] = [];
  lines.push(`Focus: ${today.plan?.focus?.trim() || "(no focus set yet — set one)"}`);
  lines.push(
    `Deck: ${today.tasks.length} on today, ${today.overdue.length} overdue, ${today.inboxCount} in inbox`
  );
  if (today.tasks.length > 0) {
    lines.push("On deck:");
    for (const t of today.tasks.slice(0, 6)) lines.push(`  • ${t.title}`);
  }
  if (today.overdue.length > 0) {
    lines.push("Overdue:");
    for (const t of today.overdue.slice(0, 4)) lines.push(`  ! ${t.title}`);
  }
  if (today.calendarEvents.length > 0) {
    lines.push("Calendar:");
    for (const e of today.calendarEvents.slice(0, 5)) {
      lines.push(`  ◷ ${new Date(e.startAt).toISOString().slice(11, 16)} ${e.title}`);
    }
  }
  if (today.habits.length > 0) {
    lines.push(`Habits: ${today.habits.map((h: any) => `${h.name} (streak ${h.streak})`).join(" · ")}`);
  }
  const attention = today.bridgeSignals.filter((s: any) => s.severity !== "info");
  if (attention.length > 0) {
    lines.push("Signals worth a look:");
    for (const s of attention.slice(0, 3)) lines.push(`  ⇄ ${s.title}`);
  }
  if (today.stats?.followThrough !== null && today.stats?.followThrough !== undefined) {
    lines.push(`Follow-through last 7 days: ${today.stats.followThrough}%`);
  }
  const skeleton = lines.join("\n");

  const briefing = await voiceOver(
    skeleton,
    `Write Cole's morning briefing from the ground truth below. Marcus-Aurelius-through-a-tactical-lens:
open with one line that sets the tone for the day (not a quote — your own words),
then the shape of the day (what matters, what's at risk, what to hit first),
then close with a single directive sentence. Under 180 words. No headers, no bullets-for-the-sake-of-bullets.`
  );

  const instance = await fileInstance("morning_briefing", briefing, {
    date: today.date,
    taskCount: today.tasks.length,
    overdueCount: today.overdue.length,
  });

  console.log(`[rituals] morning briefing generated (${instance.id})`);
  return { instance, briefing };
}

// ── Nightly debrief ──────────────────────────────────────────────────
// Wraps the deterministic nightly pulse (gap math) and voices the close.

export async function generateNightlyDebrief(dateStr?: string) {
  const pulse = await runNightlyPulse(dateStr);

  const skeleton = [
    `Done today: ${pulse.doneToday} · left open: ${pulse.openToday} · overdue: ${pulse.overdue}`,
    `Intent-action gap: ${(pulse.gapScore * 100).toFixed(0)}% of the deck didn't move`,
    pulse.missedHabits.length > 0 ? `Habits missed: ${pulse.missedHabits.join(", ")}` : "All habits hit.",
  ].join("\n");

  const debrief = await voiceOver(
    skeleton,
    `Write Cole's nightly debrief from the ground truth below. Honest, no flattery:
name what moved and what didn't, one observation about the pattern if there is one,
and one sentence on how tomorrow starts. Under 120 words.`
  );

  const instance = await fileInstance("nightly_debrief", debrief, {
    date: pulse.date,
    gapScore: pulse.gapScore,
  });

  console.log(`[rituals] nightly debrief generated (${instance.id})`);
  return { instance, debrief };
}

// ── Reads ────────────────────────────────────────────────────────────

export async function getLatestRituals() {
  const instances = await prisma.ritualInstance.findMany({
    orderBy: { firedAt: "desc" },
    take: 10,
    include: { ritual: { select: { name: true } } },
  });
  // Latest instance per ritual name
  const latest: Record<string, any> = {};
  for (const i of instances) {
    if (!latest[i.ritual.name]) {
      latest[i.ritual.name] = {
        id: i.id,
        ritual: i.ritual.name,
        firedAt: i.firedAt,
        status: i.status,
        outputText: i.outputText,
      };
    }
  }
  return latest;
}
