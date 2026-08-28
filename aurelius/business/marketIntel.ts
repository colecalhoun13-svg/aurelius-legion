// aurelius/business/marketIntel.ts
//
// MARKET INTEL — two research-backed reads that point Cole at WHERE to compete,
// not just what to say:
//   • nicheWedge (#8) — where he can plant a flag the field is leaving open: an
//     under-served athlete/sport/format his standard fits and others aren't
//     doing well. For floating a new program or sharpening the positioning.
//   • competitorIntel (#37) — what comparable remote coaches actually promise,
//     charge-signal, and sound like, and the gaps between them Cole can own.
//     Competitors here are OTHER REMOTE COACHES — never the gym he works for.
//
// Both are RESEARCH-GROUNDED and honest about it (the marketing engine's rule):
// a run that couldn't retrieve sources is labelled model-priors, not findings —
// "grounding: none" is printed, not hidden. Keyless / research-down → they still
// answer from priors but SAY so; a hard engine failure refuses rather than
// filing an error as intel (hard rule 3).

import { runLLM } from "../llm/runLLM.ts";
import { engineUnavailableText } from "../llm/nonAnswer.ts";

type IntelSource = { title: string; url?: string; source: string };

/** One best-effort research pass → grounded text + honest label + sources. */
async function researchPass(query: string, subject: string): Promise<{ text: string; grounding: "external" | "none"; sources: IntelSource[] }> {
  try {
    const { runResearch } = await import("../research/researchEngine.ts");
    const res: any = await runResearch({ query, operator: "business", depth: "deep", subject, kind: "topic" });
    const body = [res?.synthesis, ...(res?.insights ?? [])].filter(Boolean).join("\n\n");
    if (body && !engineUnavailableText(body)) {
      const sources: IntelSource[] = (res?.rawResults ?? [])
        .filter((r: any) => r.source !== "llm" && r.url)
        .slice(0, 6)
        .map((r: any) => ({ title: r.title, url: r.url, source: r.source }));
      return { text: body.slice(0, 5000), grounding: sources.length > 0 && res?.grounding === "external" ? "external" : "none", sources };
    }
  } catch {
    /* research down — caller reasons from priors and says so */
  }
  return { text: "", grounding: "none", sources: [] };
}

function label(grounding: "external" | "none", n: number): string {
  return grounding === "external"
    ? `Grounded in ${n} external source(s) — real findings, cited below.`
    : "Model priors, NOT external findings — no sources retrieved. Treat as a starting hypothesis to test, not fact.";
}

export async function nicheWedge(topic?: string): Promise<{ ok: boolean; wedge?: string; grounding: string; sources: IntelSource[]; error?: string }> {
  const { businessContextBlock, businessResearchContext } = await import("./positioning.ts");
  const [bizBlock, researchCtx] = await Promise.all([businessContextBlock(), businessResearchContext()]);
  const focus = (topic ?? "").trim();

  const research = await researchPass(
    `Under-served niches in remote strength & athletic coaching${focus ? ` related to: ${focus}` : ""} — which athletes/sports/formats are poorly served by existing remote coaches, and where a standard-setter could plant a flag. Context: ${researchCtx}`,
    "under-served niches in remote athletic coaching"
  );

  const res = await runLLM({
    taskType: "chat",
    operators: { primary: "business", secondaries: ["content"] },
    noReuse: true,
    omitToolCatalog: true,
    input:
      `${bizBlock}\n\n${research.text ? `RESEARCH:\n${research.text}\n\n` : ""}` +
      `Find 2-3 NICHE WEDGES for Cole${focus ? ` around "${focus}"` : ""} — specific under-served athlete/sport/format spots his standard genuinely fits and the field is leaving open. ` +
      `For each: who exactly, why it's open, why HE fits it, and the cheapest way to test demand. ` +
      `${research.grounding === "external" ? "Ground it in the research above." : "You have no external research — say plainly these are hypotheses to test, not findings."} ` +
      `RULES: never invent a result; no hype; short. Numbered list.`,
  });
  const wedge = (res.text ?? "").trim();
  if (!wedge || wedge.length < 50 || engineUnavailableText(wedge)) {
    return { ok: false, grounding: "none", sources: [], error: "No engine available — refusing to invent a wedge. Nothing filed." };
  }
  return { ok: true, wedge, grounding: label(research.grounding, research.sources.length), sources: research.sources };
}

export async function competitorIntel(names?: string): Promise<{ ok: boolean; intel?: string; grounding: string; sources: IntelSource[]; error?: string }> {
  const { businessContextBlock, businessResearchContext } = await import("./positioning.ts");
  const [bizBlock, researchCtx] = await Promise.all([businessContextBlock(), businessResearchContext()]);
  const who = (names ?? "").trim();

  const research = await researchPass(
    `${who ? `These remote strength/athletic coaches or programs: ${who}. ` : "Well-known remote strength & athletic coaching programs for youth/HS athletes. "}` +
      `What they promise, how they position, price signals, and the gaps between them. Context: ${researchCtx}`,
    "remote athletic coaching competitors and positioning"
  );

  const res = await runLLM({
    taskType: "chat",
    operators: { primary: "business", secondaries: ["strategy"] },
    noReuse: true,
    omitToolCatalog: true,
    input:
      `${bizBlock}\n\n${research.text ? `RESEARCH:\n${research.text}\n\n` : ""}` +
      `Give Cole competitor intel on remote athletic coaching${who ? ` (focus: ${who})` : ""}. Cover: how comparable coaches position and promise, any price signals, and — most important — the POSITIONING GAPS Cole (a standard-setter, not a guarantee coach) could own. ` +
      `These are OTHER remote coaches, never the gym he works for. ` +
      `${research.grounding === "external" ? "Ground it in the research above and cite where you can." : "You retrieved no sources — say plainly this is informed inference, not verified intel."} ` +
      `RULES: never fabricate a specific claim/price about a named competitor; if unsure, say 'likely' or leave it out. Short. What Cole should DO with it in one line.`,
  });
  const intel = (res.text ?? "").trim();
  if (!intel || intel.length < 50 || engineUnavailableText(intel)) {
    return { ok: false, grounding: "none", sources: [], error: "No engine available — refusing to invent competitor intel. Nothing filed." };
  }
  return { ok: true, intel, grounding: label(research.grounding, research.sources.length), sources: research.sources };
}
