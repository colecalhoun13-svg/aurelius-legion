// aurelius/autonomy/initiative.ts
//
// THE INITIATIVE PULSE — Aurelius notices, and proposes.
//
// The OG doc's autonomy ladder: react → schedule → INITIATE. This is the
// third rung, held to the propose→confirm rule: Aurelius scans its own
// state deterministically (no LLM needed to notice), and where it finds
// something worth working on it CREATES a mission in "proposed" status —
// never runs it. Cole launches from the Aurelius page or the Bridge.
//
// Scanners (v1, all deterministic):
//   1. follow-through slipping — repeated high intent-action gaps
//   2. stale domain — corpus domains with no new material in 10+ days
//   3. project at risk — past target date, or open tasks with no
//      completions in 7+ days
//   4. thin domain — a domain Cole works in but the brain barely knows

import { prisma } from "../core/db/prisma.ts";
import { createMission } from "../missions/engine.ts";
import { isActionGranted } from "./grants.ts";

type Proposal = { title: string; objective: string; domain: string; operatorName?: string };

async function alreadyInFlight(title: string): Promise<boolean> {
  const existing = await prisma.mission.findFirst({
    where: { title, status: { in: ["proposed", "planned", "running"] } },
  });
  return !!existing;
}

export async function runInitiativePulse() {
  const now = Date.now();
  const week = new Date(now - 7 * 24 * 3600 * 1000);
  const tenDays = new Date(now - 10 * 24 * 3600 * 1000);
  const candidates: Proposal[] = [];

  // 1. Follow-through slipping
  const gaps = await prisma.intentActionGap.findMany({
    where: { windowStart: { gte: week } },
    select: { gapScore: true },
  });
  if (gaps.length >= 3) {
    const avg = gaps.reduce((s, g) => s + g.gapScore, 0) / gaps.length;
    if (avg >= 0.5) {
      candidates.push({
        title: "Diagnose the follow-through slide",
        objective: `Follow-through averaged ${Math.round((1 - avg) * 100)}% over ${gaps.length} measured days. Recall what was planned vs done this week, find the pattern in what keeps slipping (time of day, domain, task size), and report the single highest-leverage change.`,
        domain: "personal",
        operatorName: "strategy",
      });
    }
  }

  // 2 + 4. Stale and thin domains
  const domains = await prisma.corpusDocument.groupBy({
    by: ["domain"],
    _count: { id: true },
    _max: { createdAt: true },
  });
  for (const d of domains) {
    if (!d.domain) continue; // a null domain would propose "Refresh the null field"
    if (d._max.createdAt && d._max.createdAt < tenDays) {
      candidates.push({
        title: `Refresh the ${d.domain} field`,
        objective: `The ${d.domain} corpus hasn't grown since ${d._max.createdAt.toISOString().slice(0, 10)}. Recall what we hold, research what has moved in the field since, and synthesize what changed and what's worth absorbing.`,
        domain: d.domain,
      });
    } else if (d._count.id <= 2) {
      candidates.push({
        title: `Deepen the ${d.domain} base`,
        objective: `The ${d.domain} domain holds only ${d._count.id} document${d._count.id === 1 ? "" : "s"} — too thin to answer from. Recall what exists, research the foundational material the domain is missing, and synthesize a reading/ingestion shortlist.`,
        domain: d.domain,
      });
    }
  }

  // 3. Projects at risk
  const projects = await prisma.project.findMany({
    where: { status: "active" },
    select: { id: true, name: true, domain: true, targetDate: true },
  });
  for (const p of projects) {
    const [open, recentDone] = await Promise.all([
      prisma.task.count({ where: { projectId: p.id, status: { notIn: ["done", "abandoned"] } } }),
      prisma.task.count({ where: { projectId: p.id, status: "done", completedAt: { gte: week } } }),
    ]);
    const pastTarget = p.targetDate !== null && p.targetDate < new Date();
    if (open > 0 && (pastTarget || recentDone === 0)) {
      candidates.push({
        title: `Unblock "${p.name}"`,
        objective: `Project "${p.name}" has ${open} open tasks and ${pastTarget ? "is past its target date" : "no completions in 7 days"}. Recall its tasks and context, identify the real blocker, and report the shortest path to movement this week.`,
        domain: p.domain,
      });
    }
  }

  // Create the missions, then decide: if research.ingest is GRANTED, Aurelius
  // runs its own proposals through the acting layer (NORTH_STAR §4 — "the acting
  // layer is what changes that"); otherwise they stay proposed for Cole to launch.
  //
  // HARD CAP on auto-run: the candidate set is data-driven (one per stale/thin
  // domain + at-risk project) and can be large. Firing every one as a detached
  // promise would launch a swarm of concurrent multi-LLM missions on a single
  // tick — a rate-limit/cost storm, unattended. Cap per pulse, and run the batch
  // SEQUENTIALLY in the background so at most one mission is in flight at a time.
  const MAX_AUTORUN_PER_PULSE = 3;
  const granted = await isActionGranted("research.ingest");
  const proposed: string[] = [];
  const ran: string[] = [];
  const toRun: string[] = [];
  for (const c of candidates) {
    if (await alreadyInFlight(c.title)) continue;
    const mission = await createMission({ ...c, origin: "aurelius_proposed" });
    if (granted && toRun.length < MAX_AUTORUN_PER_PULSE) {
      toRun.push(mission.id);
      ran.push(mission.title);
    } else {
      // Over the cap (or ungranted) → stays proposed for Cole to launch.
      proposed.push(mission.title);
    }
  }
  if (toRun.length > 0) {
    // Detached from the pulse, but sequential within the batch.
    (async () => {
      const { runMissionThroughActingLayer } = await import("./workflows/researchIngest.ts");
      for (const id of toRun) {
        try {
          await runMissionThroughActingLayer(id);
        } catch (err) {
          console.error("[initiative] auto-run failed:", err);
        }
      }
    })().catch((err) => console.error("[initiative] auto-run batch failed:", err));
  }

  if (proposed.length > 0) {
    await prisma.bridgeSignal.create({
      data: {
        kind: "opportunity",
        domain: "personal",
        sourceType: "mission",
        severity: "notice",
        title: `Aurelius proposes ${proposed.length} mission${proposed.length === 1 ? "" : "s"}`,
        body:
          proposed.map((t) => `• ${t}`).join("\n") +
          "\n\nProposed only — launch from the Aurelius page, or ignore and they wait.",
      },
    });
  }

  console.log(
    `[initiative] scanned ${candidates.length} candidates · ${proposed.length} proposed · ${ran.length} auto-run (research.ingest granted)`
  );
  return { candidates: candidates.length, proposed, ran };
}
