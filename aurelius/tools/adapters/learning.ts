// aurelius/tools/adapters/learning.ts
//
// The curriculum surface as a chat tool — so Cole can kick off a study session
// or check how far Aurelius has read, without waiting for the Sunday-night
// ritual. Pure delegation to learning/curriculum.ts.

import type { ToolAdapter, ToolAdapterResult } from "../types.ts";
import { runCurriculumIngest, getCurriculumProgress } from "../../learning/curriculum.ts";

export const learningAdapter: ToolAdapter = {
  name: "learning",
  description:
    "Aurelius's self-education across every field's canon (strategy → Sun Tzu, Musashi; wealth → Buffett, Taleb; identity → the Stoics; etc.). Study the next unit now, or report how far it has read. Runs weekly on its own; this is the on-demand handle.",
  actions: [
    {
      name: "reading_progress",
      description:
        "Show how far Aurelius has read through each field's canon. Use for 'how well-read are you' / 'what have you studied' / 'how far through the reading are you'.",
      dataSchema: "{} (no fields)",
    },
    {
      name: "study_now",
      description:
        "Run a study session immediately — research the next canon unit for each field (or one), ingest it into the second brain, refresh the wiki. Use for 'study the next lessons now' / 'go read up on strategy'. Optional domain to focus one field.",
      dataSchema: '{ domain?: string (e.g. "strategy", "wealth"), maxUnits?: number }',
      example: '[TOOL: learning.study_now {"domain": "strategy"}]',
    },
  ],

  async run(action, data): Promise<ToolAdapterResult> {
    switch (action) {
      case "reading_progress": {
        const progress = await getCurriculumProgress();
        const lines = progress.map(
          (p) => `${p.label}: ${p.read}/${p.total} read${p.cycles > 0 ? ` · ${p.cycles} refresh cycle${p.cycles === 1 ? "" : "s"}` : ""}`
        );
        return {
          ok: true,
          output: {
            summary: lines.join(" · "),
            progress,
          },
        };
      }

      case "study_now": {
        const domain = data?.domain ? String(data.domain) : undefined;
        const maxUnits = data?.maxUnits != null ? Number(data.maxUnits) : undefined;
        const res = await runCurriculumIngest({ onlyDomain: domain, maxUnits });
        if (!res.ok) return { ok: false, output: null, error: res.error ?? "curriculum run failed" };
        return {
          ok: true,
          output: {
            summary: res.studied.length
              ? `Studied ${res.studied.length}: ${res.studied.map((s) => s.title).join("; ")}`
              : `Nothing studied${res.skipped.length ? ` — ${res.skipped[0].reason}` : ""}.`,
            studied: res.studied,
            skipped: res.skipped,
          },
        };
      }

      default:
        return { ok: false, output: null, error: `unknown learning action: ${action}` };
    }
  },
};
