// aurelius/core/watchdog.ts
//
// THE SELF-WATCHDOG (6.5) — exit a wedged spine so a supervisor restarts it.
//
// The dead-man Healthchecks ping proves the PROCESS is alive; it does not prove
// the SPINE works. A process can sit up for days with node-schedule silently
// dead (a swallowed timer, a hung event loop) and never record a JobRun — and
// nothing notices, because "alive" and "doing its job" are different facts.
//
// This checks the one signal that means the spine actually ran: the newest
// JobRun row. If the process has been up long enough that a healthy spine WOULD
// have recorded one, and none is fresh, the spine is wedged — exit(1) so the
// process supervisor (systemd / pm2 / Railway / the Mini's launchd) restarts a
// clean one. The uptime guard is what makes this safe: a fresh boot resets
// uptime, so a healthy restart can never trip it, and a persistently-broken
// spine restarts slowly rather than looping tight.

import { prisma } from "./db/prisma.ts";

// Just past the daily spine cycle — a spine that hasn't recorded a single job in
// over a day is not merely quiet, it's stopped.
const STALE_HOURS = 26;

export function startWatchdog(checkEveryMs = 60 * 60 * 1000): void {
  const check = async () => {
    // Only judge after the process has been up long enough that a working spine
    // would already have claimed at least one daily job — otherwise a fresh boot
    // could exit itself before the first job's cron even fired.
    if (process.uptime() < STALE_HOURS * 3600) return;
    const latest = await prisma.jobRun
      .findFirst({ orderBy: { createdAt: "desc" }, select: { createdAt: true } })
      .catch(() => null);
    const ageH = latest ? (Date.now() - latest.createdAt.getTime()) / 3_600_000 : Infinity;
    if (ageH > STALE_HOURS) {
      console.error(
        `[watchdog] no JobRun in ${ageH === Infinity ? "any" : ageH.toFixed(1) + "h"} while up ` +
          `${(process.uptime() / 3600).toFixed(1)}h — the scheduled spine is wedged. Exiting for the supervisor to restart.`
      );
      process.exit(1);
    }
  };
  setInterval(() => {
    check().catch((err) => console.warn("[watchdog] check failed (non-fatal):", (err as any)?.message ?? err));
  }, checkEveryMs);
  console.log(`[watchdog] armed — exits if no JobRun in ${STALE_HOURS}h (supervisor restarts a clean spine)`);
}
