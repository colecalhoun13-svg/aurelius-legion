// aurelius/athlete/progressArtifact.ts
//
// ATHLETE-FACING PROGRESS ARTIFACT (NORTH_STAR #18) — the record wall exists
// but it's coach-only; no athlete has ever seen their own progress. This builds
// a shareable progress piece FROM an athlete's real numbers — PRs, the measures
// that are moving, where they're tracking against their targets — in a voice
// that speaks TO the athlete (and, for a minor, their parent).
//
// INWARD to build: it drafts the artifact; Cole reads it and shares it himself.
// Sharing is his hand — there's no athlete portal auto-sending anything, and for
// a minor a parent-facing piece is a consent decision, not an automatic push.
// Grounded ONLY in real logged numbers (hard rule 3 — never invents a PR or a
// stat); keyless → refuses rather than fabricating encouragement.

import { prisma } from "../core/db/prisma.ts";
import { runLLM } from "../llm/runLLM.ts";
import { engineUnavailableText } from "../llm/nonAnswer.ts";

export async function buildProgressArtifact(clientId: string): Promise<{ ok: boolean; artifact?: string; forMinor?: boolean; error?: string }> {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { name: true, sport: true, isMinor: true, parentName: true },
  });
  if (!client) return { ok: false, error: "No such athlete." };

  const { athletePerformance } = await import("../crm/performance.ts");
  const { developmentCurves } = await import("../training/devCurves.ts");
  const [perf, curves] = await Promise.all([athletePerformance(clientId), developmentCurves(clientId)]);
  if (!perf || perf.series.length === 0) {
    return { ok: false, error: `No logged numbers for ${client.name} yet — nothing real to build a progress piece from (I won't invent one).` };
  }

  // Assemble the GROUND TRUTH the model may speak from — real numbers only.
  const prs = perf.series.filter((s) => s.prCount > 0).map((s) => `${s.label}: best ${s.best.value}${s.unit ?? ""}`);
  const moving = perf.series
    .filter((s) => (s.improvementPct ?? 0) > 0)
    .map((s) => `${s.label}: +${s.improvementPct}% since starting (now ${s.latest.value}${s.unit ?? ""})`);
  const targets = perf.targets
    .filter((t) => t.latestValue != null)
    .map((t) => `${t.label}: at ${t.latestValue}${t.unit ?? ""} toward ${t.targetValue}${t.unit ?? ""} (${t.pace})`);
  const heading = (curves?.curves ?? [])
    .filter((c) => c.trajectory === "accelerating" || c.trajectory === "steady")
    .map((c) => `${c.measure}: trending ${c.trajectory}`);

  const ground = [
    prs.length ? `PERSONAL BESTS:\n- ${prs.join("\n- ")}` : "",
    moving.length ? `IMPROVING:\n- ${moving.join("\n- ")}` : "",
    targets.length ? `TOWARD GOALS:\n- ${targets.join("\n- ")}` : "",
    heading.length ? `TRAJECTORY:\n- ${heading.join("\n- ")}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const audience = client.isMinor ? `${client.name} and their parent${client.parentName ? ` (${client.parentName})` : ""}` : client.name;

  const res = await runLLM({
    taskType: "chat",
    operators: { primary: "training", secondaries: ["content"] },
    noReuse: true,
    omitToolCatalog: true,
    input:
      `Write a short, shareable progress update for ${audience}${client.sport ? ` (${client.sport})` : ""}, in Cole's coaching voice — speaking TO the athlete${client.isMinor ? " and parent" : ""}, encouraging but honest.\n\n` +
      `Use ONLY these real numbers — do not add, round up, or invent anything:\n${ground}\n\n` +
      `RULES: celebrate the real wins, name honestly what's next (a behind-pace target is a next step, not a failure), no hype, no fabricated stats, no medical/injury claims. Standard-setter tone. 120-180 words. Return the piece, ready to share.`,
  });
  const artifact = (res.text ?? "").trim();
  if (!artifact || artifact.length < 60 || engineUnavailableText(artifact)) {
    return { ok: false, error: "No engine available — refusing to fabricate a progress piece. Nothing built." };
  }
  return { ok: true, artifact, forMinor: !!client.isMinor };
}
