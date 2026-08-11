// aurelius/research/deepWork.ts
//
// DEEP WORK — research that produces a DELIVERABLE, not just a memory.
//
// The research engine (researchEngine.ts) is strong, but everything it finds
// gets filed into Aurelius's own brain — Cole never sees a finished document.
// This is the missing hand: give it a brief, and it decomposes the brief into
// research angles, runs the multi-source engine on each, and synthesizes ONE
// full structured report (markdown) handed back to Cole AND saved to the corpus
// so the brain keeps it too.
//
// Honest by construction (hard rule 3): no engine → it fails loudly with the
// fix, never a fabricated report; and when no live-web/open source backed the
// findings, the report says so at the top ("model-only") instead of implying
// it went and looked. Live web needs TAVILY_API_KEY or GEMINI_API_KEY; without
// either, research runs model-only and the banner is truthful.

import { runResearch } from "./researchEngine.ts";
import type { ResearchResult } from "./researchTypes.ts";

export type DeepReportInput = {
  brief: string;
  operator?: string; // lens: "strategy" (default), "training", "business", …
  depth?: "shallow" | "medium" | "deep";
  maxAngles?: number; // how many research angles to break the brief into
  save?: boolean; // file the finished report into the corpus (default true)
};

export type DeepReport = {
  ok: boolean;
  error?: string;
  title?: string;
  markdown?: string; // the full report
  sources?: Array<{ title: string; url?: string }>;
  grounding?: "external" | "model-only";
  angles?: string[]; // the research questions it pursued
  docId?: string; // corpus id when saved
};

/** Break the brief into focused, searchable research angles. Falls back to the
 *  brief itself as a single angle if the engine can't shape questions. */
async function planAngles(brief: string, operator: string, maxAngles: number): Promise<{ title: string; angles: string[] }> {
  const { runLLM } = await import("../llm/runLLM.ts");
  const { engineUnavailableText } = await import("../llm/nonAnswer.ts");
  const res = await runLLM({
    taskType: "chat",
    operators: { primary: operator, secondaries: [] },
    noReuse: true,
    omitToolCatalog: true,
    input:
      `You are planning a research report. The brief:\n"""${brief.slice(0, 1500)}"""\n\n` +
      `Return STRICT JSON, no prose, no code fence:\n` +
      `{"title": "<a crisp report title, <=80 chars>", "angles": ["<focused, searchable research question>", …]}\n` +
      `Give ${Math.min(Math.max(maxAngles, 2), 6)} angles at most — each a distinct sub-question a good search string could answer. ` +
      `No angle should restate the brief verbatim.`,
  });
  const text = (res.text ?? "").trim();
  if (!text || engineUnavailableText(text)) {
    throw new Error("no engine available to plan the research");
  }
  try {
    const jsonStr = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
    const parsed = JSON.parse(jsonStr);
    const angles = Array.isArray(parsed.angles)
      ? parsed.angles.map((a: any) => String(a).trim()).filter(Boolean).slice(0, 6)
      : [];
    const title = String(parsed.title ?? "").trim() || brief.slice(0, 80);
    if (angles.length === 0) return { title, angles: [brief] };
    return { title, angles };
  } catch {
    // Unparseable plan → still deliver: research the brief as one angle.
    return { title: brief.slice(0, 80), angles: [brief] };
  }
}

/** The main entry: brief → full researched report. */
export async function deepResearchReport(input: DeepReportInput): Promise<DeepReport> {
  const brief = (input.brief ?? "").trim();
  if (brief.length < 8) return { ok: false, error: "Give me a real brief — a sentence or two on what to research." };
  const operator = (input.operator ?? "strategy").trim() || "strategy";
  const depth = input.depth ?? "medium";
  const maxAngles = input.maxAngles ?? 4;
  const save = input.save !== false;

  // 1) Plan the angles.
  let plan: { title: string; angles: string[] };
  try {
    plan = await planAngles(brief, operator, maxAngles);
  } catch (err: any) {
    return { ok: false, error: `Deep research needs a working LLM engine — ${err?.message ?? err}. Fund an API key and try again.` };
  }

  // 2) Run the research engine on each angle. Independent — one angle failing
  //    doesn't sink the report.
  const perAngle: Array<{ angle: string; synthesis: string; insights: string[]; results: ResearchResult[]; grounding: string }> = [];
  for (const angle of plan.angles) {
    try {
      const out = await runResearch({ query: angle, operator, depth });
      perAngle.push({ angle, synthesis: out.synthesis, insights: out.insights, results: out.rawResults, grounding: out.grounding });
    } catch (err: any) {
      perAngle.push({ angle, synthesis: "", insights: [], results: [], grounding: "model-only" });
      console.warn(`[deepwork] angle failed (${angle.slice(0, 60)}):`, err?.message ?? err);
    }
  }

  const anyExternal = perAngle.some((a) => a.grounding === "external");
  const grounding: "external" | "model-only" = anyExternal ? "external" : "model-only";

  // Dedup a flat source list (only real URLs — the audit trail Cole can click).
  const seen = new Set<string>();
  const sources: Array<{ title: string; url?: string }> = [];
  for (const a of perAngle) {
    for (const r of a.results) {
      if (!r.url || seen.has(r.url)) continue;
      seen.add(r.url);
      sources.push({ title: r.title || r.url, url: r.url });
    }
  }

  // 3) Synthesize the full report from everything gathered.
  const material = perAngle
    .map((a, i) => {
      const findings = a.insights.length ? a.insights.map((x) => `  - ${x}`).join("\n") : "  - (no discrete findings)";
      const srcs = a.results
        .filter((r) => r.url)
        .slice(0, 6)
        .map((r) => `  · ${r.title} — ${r.url}`)
        .join("\n");
      return `### Angle ${i + 1}: ${a.angle}\nSynthesis: ${a.synthesis || "(none)"}\nFindings:\n${findings}${srcs ? `\nSources:\n${srcs}` : ""}`;
    })
    .join("\n\n");

  const { runLLM } = await import("../llm/runLLM.ts");
  const { engineUnavailableText } = await import("../llm/nonAnswer.ts");
  const res = await runLLM({
    taskType: "chat",
    operators: { primary: operator, secondaries: [] },
    noReuse: true,
    omitToolCatalog: true,
    input:
      `Write a thorough, well-structured research report in MARKDOWN answering this brief:\n"""${brief}"""\n\n` +
      `You have gathered this material across ${perAngle.length} research angles:\n\n${material}\n\n` +
      `RULES:\n` +
      `- Structure: an "## Executive summary" (3-5 sentences), then one "## " section per angle with the substantive findings written as real prose (not just bullets), then "## What this means" (practical takeaways for the reader), then "## Open questions" if any remain.\n` +
      `- Ground claims in the gathered findings; do NOT invent statistics or sources. Where the material is thin, say what's uncertain rather than padding.\n` +
      `- Do NOT include a sources list — it is appended automatically.\n` +
      `- Start directly with the "# <title>" line. Be genuinely useful and specific.`,
  });
  const body = (res.text ?? "").trim();
  if (!body || engineUnavailableText(body)) {
    return { ok: false, error: "The research ran, but no engine was available to write the report. Nothing was fabricated." };
  }

  // Assemble the deliverable: honest grounding banner + report + sources.
  const banner =
    grounding === "model-only"
      ? `> ⚠️ **Model-only** — no live web or open-source result backed this. It reflects the model's existing knowledge, not fresh research. Set \`TAVILY_API_KEY\` or \`GEMINI_API_KEY\` for live web-grounded reports.\n\n`
      : `> ✓ Web-grounded — findings drew on ${sources.length} external source${sources.length === 1 ? "" : "s"} (listed below).\n\n`;
  const sourcesBlock = sources.length
    ? `\n\n## Sources\n${sources.map((s, i) => `${i + 1}. [${s.title}](${s.url})`).join("\n")}`
    : "";
  const markdown = `${banner}${body}${sourcesBlock}`;

  // 4) File it into the corpus (the brain keeps it too) — best-effort.
  let docId: string | undefined;
  if (save) {
    try {
      const { ingestDocument } = await import("../corpus/ingest.ts");
      const doc = await ingestDocument({
        title: `[report] ${plan.title}`,
        content: markdown,
        sourceType: "research",
        domain: operator === "training" ? "training" : operator === "business" ? "business" : "personal",
      });
      docId = (doc as any)?.id;
    } catch (err: any) {
      console.warn("[deepwork] corpus save failed (report still returned):", err?.message ?? err);
    }
  }

  return { ok: true, title: plan.title, markdown, sources, grounding, angles: plan.angles, docId };
}
