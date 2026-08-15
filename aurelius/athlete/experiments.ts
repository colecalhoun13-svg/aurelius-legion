// aurelius/athlete/experiments.ts
//
// n=1 SELF-EXPERIMENTS (NORTH_STAR #45) — Cole testing things on himself the
// way he'd test a training variable on an athlete: a hypothesis, a metric to
// watch, a baseline captured at the start, a result at the end, and an HONEST
// verdict. The honesty is the whole point: n=1 with no control is a SIGNAL, not
// proof, and the verdict says so — it never dresses a coincidence as causation.
//
// Ties to Cole's own metrics on the self record (kind:"self"), so logging his
// numbers during the window IS the experiment's data. Personal + inward; no
// business machinery, ever.

import { prisma } from "../core/db/prisma.ts";

async function latestSelfMetric(label: string): Promise<number | null> {
  const { getSelf } = await import("./self.ts");
  const self = await getSelf();
  if (!self) return null;
  const m = await prisma.metric.findFirst({
    where: { clientId: self.id, label: { equals: label.trim(), mode: "insensitive" } },
    orderBy: { achievedAt: "desc" },
    select: { value: true },
  });
  return m?.value ?? null;
}

export async function startExperiment(input: { hypothesis: string; metricLabel: string; protocol?: string; endAt?: string }): Promise<{ ok: boolean; id?: string; baseline?: number | null; error?: string }> {
  const hypothesis = (input.hypothesis ?? "").trim();
  const metricLabel = (input.metricLabel ?? "").trim();
  if (!hypothesis || !metricLabel) return { ok: false, error: "An experiment needs a hypothesis and the metric to watch (e.g. 'vertical')." };
  const baseline = await latestSelfMetric(metricLabel);
  const exp = await prisma.selfExperiment.create({
    data: {
      hypothesis,
      metricLabel,
      protocol: input.protocol?.trim() || null,
      baselineValue: baseline,
      endAt: input.endAt ? new Date(input.endAt) : null,
      status: "running",
    },
  });
  return { ok: true, id: exp.id, baseline };
}

export async function listExperiments(status?: string): Promise<any[]> {
  return prisma.selfExperiment.findMany({
    where: status ? { status } : {},
    orderBy: { startAt: "desc" },
    take: 50,
  });
}

export async function abandonExperiment(id: string): Promise<{ ok: boolean; error?: string }> {
  const exp = await prisma.selfExperiment.findUnique({ where: { id } });
  if (!exp) return { ok: false, error: "No such experiment." };
  await prisma.selfExperiment.update({ where: { id }, data: { status: "abandoned" } });
  return { ok: true };
}

export async function concludeExperiment(id: string): Promise<{ ok: boolean; verdict?: string; delta?: number | null; error?: string }> {
  const exp = await prisma.selfExperiment.findUnique({ where: { id } });
  if (!exp) return { ok: false, error: "No such experiment." };
  if (exp.status !== "running") return { ok: false, error: `That experiment is already ${exp.status}.` };

  const result = await latestSelfMetric(exp.metricLabel);
  const delta = result != null && exp.baselineValue != null ? Math.round((result - exp.baselineValue) * 100) / 100 : null;

  // An honest, n=1-aware verdict. Grounded in the actual numbers; refuses to
  // invent a conclusion when the engine is down or there's no data to read.
  let verdict: string;
  if (result == null) {
    verdict = `No "${exp.metricLabel}" logged during the window — nothing to measure. Log the metric and re-run, or call it inconclusive.`;
  } else if (exp.baselineValue == null) {
    verdict = `Ended at ${result} for ${exp.metricLabel}, but there was no baseline at the start — so this shows where you are, not whether "${exp.hypothesis}" moved it. Set a baseline next time.`;
  } else {
    const dir = delta! > 0 ? "up" : delta! < 0 ? "down" : "flat";
    try {
      const { runLLM } = await import("../llm/runLLM.ts");
      const { engineUnavailableText } = await import("../llm/nonAnswer.ts");
      const res = await runLLM({
        taskType: "chat",
        operator: "training",
        noReuse: true,
        omitToolCatalog: true,
        input:
          `Cole ran an n=1 self-experiment on himself.\n` +
          `Hypothesis: ${exp.hypothesis}\n${exp.protocol ? `Protocol: ${exp.protocol}\n` : ""}` +
          `Metric watched: ${exp.metricLabel}. Baseline ${exp.baselineValue} → result ${result} (${dir} ${Math.abs(delta!)}).\n\n` +
          `Give a 2-3 sentence verdict. Be HONEST that this is n=1 with no control — a signal, not proof; name confounders worth noting; say whether it's worth keeping/repeating. No overclaiming causation.`,
      });
      const t = (res.text ?? "").trim();
      verdict = t && !engineUnavailableText(t) ? t : `${exp.metricLabel} went ${dir} ${Math.abs(delta!)} (${exp.baselineValue}→${result}). n=1, no control — a signal, not proof.`;
    } catch {
      verdict = `${exp.metricLabel} went ${dir} ${Math.abs(delta!)} (${exp.baselineValue}→${result}). n=1, no control — a signal, not proof.`;
    }
  }

  await prisma.selfExperiment.update({ where: { id }, data: { status: "concluded", resultValue: result, verdict, endAt: exp.endAt ?? new Date() } });
  return { ok: true, verdict, delta };
}
