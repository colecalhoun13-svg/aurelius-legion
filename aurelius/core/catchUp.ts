// aurelius/core/catchUp.ts
//
// MISSED-SCHEDULE CATCH-UP. node-schedule only fires while the process
// lives — a reboot, a crash, or a stopped codespace silently swallows
// whatever was due. Jarvis doesn't skip the morning briefing because the
// power blinked: on boot, this sweep checks every job whose fire-time
// already passed today against the trace log (the schedule spine writes
// one row per run) and fires anything that never ran. Time-sensitive
// jobs carry an expiry — a 13:00 corrective check is noise at 17:00.

import { prisma } from "./db/prisma.ts";
import { runTraced } from "./trace.ts";

type CatchUpJob = {
  name: string; // must match the runTraced name in index.ts's scheduler
  hour: number;
  minute?: number;
  sundayOnly?: boolean;
  expiresHour?: number; // skip if caught after this local hour
  run: () => Promise<unknown>;
};

const JOBS: CatchUpJob[] = [
  {
    name: "rss_ingest",
    hour: 6,
    run: async () => (await import("../corpus/rssIngest.ts")).pollRssOnce(),
  },
  {
    name: "market_pulse",
    hour: 6,
    minute: 30,
    run: async () => (await import("../wealth/engine.ts")).runMarketPulse(),
  },
  {
    name: "schedule_protection",
    hour: 6,
    minute: 45,
    run: async () => (await import("../autonomy/workflows/scheduleProtection.ts")).runScheduleProtection({ days: 5 }),
  },
  {
    name: "morning_briefing",
    hour: 7,
    run: async () => {
      const { generateMorningBriefing } = await import("../rituals/engine.ts");
      const { sendToCole } = await import("../telegram/bot.ts");
      const { briefing } = await generateMorningBriefing();
      await sendToCole(`(late — catching up after downtime)\n\n${briefing}`);
    },
  },
  {
    name: "initiative_pulse",
    hour: 8,
    run: async () => (await import("../autonomy/initiative.ts")).runInitiativePulse(),
  },
  {
    name: "midday_check",
    hour: 13,
    expiresHour: 16, // corrective tone is pointless once the day is spent
    run: async () => (await import("../planning/tools.ts")).runMiddayCheck(),
  },
  {
    name: "nightly_debrief",
    hour: 21,
    minute: 30,
    run: async () => {
      const { generateNightlyDebrief } = await import("../rituals/engine.ts");
      const { sendToCole } = await import("../telegram/bot.ts");
      const { debrief } = await generateNightlyDebrief();
      await sendToCole(debrief);
    },
  },
  {
    name: "weekend_pulse",
    hour: 9,
    sundayOnly: true,
    run: async () => {
      const { runWeekendPulse } = await import("../autonomy/pulse.ts");
      await runWeekendPulse();
      const { synthesizeAllDomains } = await import("../wiki/engine.ts");
      await synthesizeAllDomains("weekend_pulse");
    },
  },
  {
    name: "persona_observer",
    hour: 17,
    sundayOnly: true,
    run: async () => (await import("../persona/observer.ts")).observeCommunicationStyle(),
  },
  {
    name: "weekly_planning",
    hour: 18,
    sundayOnly: true,
    run: async () => {
      const { planWeekLite } = await import("../planning/tools.ts");
      const { sendToCole } = await import("../telegram/bot.ts");
      const { briefing } = await planWeekLite();
      await sendToCole(briefing);
    },
  },
  {
    name: "freshness_sweep",
    hour: 19,
    sundayOnly: true,
    run: async () => (await import("../knowledge/freshness.ts")).runFreshnessSweep(),
  },
  {
    name: "weekly_scoreboard",
    hour: 20,
    sundayOnly: true,
    run: async () => (await import("../measurement/scoreboard.ts")).computeWeeklySnapshot(),
  },
];

/** Did this job leave a trace row today (fired = counted, even if it errored — never re-fire a crash loop)? */
async function ranToday(name: string, todayStart: Date): Promise<boolean> {
  const row = await prisma.logEntry.findFirst({
    where: {
      type: "trace",
      message: { in: [`schedule:${name}`, `catchup:${name}`] },
      createdAt: { gte: todayStart },
    },
    select: { id: true },
  });
  return !!row;
}

export async function runCatchUp() {
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const isSunday = now.getDay() === 0;

  // Cole may have re-timed a ritual from chat; honor the LIVE time so catch-up
  // fires (or waits) at the overridden hour, not the hardcoded default below.
  // A PAUSED ritual is skipped entirely — don't resurrect it via catch-up.
  const { getEffectiveTime, isJobEnabled } = await import("./schedule.ts");

  let fired = 0;
  for (const job of JOBS) {
    if (job.sundayOnly && !isSunday) continue;
    if (!isJobEnabled(job.name)) continue;
    const eff = getEffectiveTime(job.name);
    const hour = eff?.hour ?? job.hour;
    const minute = eff?.minute ?? job.minute ?? 0;
    const due = new Date(now);
    due.setHours(hour, minute, 0, 0);
    if (due > now) continue; // not due yet today — the live scheduler owns it
    // Expiry is relative to the EFFECTIVE hour (Cole may have re-timed the job),
    // not the hardcoded default — otherwise moving the midday check past its
    // default expiry makes it permanently un-catchable.
    const effectiveExpiry = job.expiresHour !== undefined ? hour + (job.expiresHour - job.hour) : undefined;
    if (effectiveExpiry !== undefined && now.getHours() >= effectiveExpiry) continue;
    if (await ranToday(job.name, todayStart)) continue;

    console.log(`[catchup] ${job.name} was due ${hour}:${String(minute).padStart(2, "0")} and never ran — firing now`);
    try {
      await runTraced("catchup", job.name, job.run);
      fired++;
    } catch (err) {
      console.warn(`[catchup] ${job.name} failed (won't retry until next boot):`, (err as any)?.message ?? err);
    }
  }
  if (fired > 0) console.log(`[catchup] ${fired} missed run(s) recovered`);
  return { fired };
}

/** Boot hook — waits for DB/bridges to settle, then sweeps once. */
export function startCatchUp(delayMs = 45_000) {
  setTimeout(() => {
    runCatchUp().catch((err) => console.warn("[catchup] sweep failed:", err?.message ?? err));
  }, delayMs);
}
