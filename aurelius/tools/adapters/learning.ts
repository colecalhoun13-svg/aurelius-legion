// aurelius/tools/adapters/learning.ts
//
// The curriculum surface as a chat tool — so Cole can kick off a study session
// or check how far Aurelius has read, without waiting for the Sunday-night
// ritual. Pure delegation to learning/curriculum.ts.

import type { ToolAdapter, ToolAdapterResult } from "../types.ts";
import { runCurriculumIngest, getCurriculumProgress, CURRICULUM } from "../../learning/curriculum.ts";

const KNOWN_DOMAINS = new Set(CURRICULUM.map((t) => t.domain));

export const learningAdapter: ToolAdapter = {
  name: "learning",
  // A real study session (research → ingest → wiki refresh) legitimately runs
  // for minutes — the engine's default 2-min timeout killed mid-flight runs.
  // And never auto-retry: a re-fired study double-spends research + ingestion.
  maxRetries: 0,
  timeoutMs: 10 * 60_000,
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
        const domain = data?.domain ? String(data.domain).trim().toLowerCase() : undefined;
        // Validate a hostile/garbled maxUnits rather than silently no-op'ing.
        let maxUnits: number | undefined;
        if (data?.maxUnits != null) {
          const n = Number(data.maxUnits);
          if (!Number.isFinite(n) || n < 1) {
            return { ok: false, output: null, error: `maxUnits must be a positive number (got ${JSON.stringify(data.maxUnits)})` };
          }
          maxUnits = Math.min(Math.floor(n), 20);
        }
        if (domain && !KNOWN_DOMAINS.has(domain)) {
          return { ok: false, output: null, error: `unknown field "${domain}". Known: ${[...KNOWN_DOMAINS].join(", ")}` };
        }
        // BACKGROUND, always. A real study session (research → ingest → wiki)
        // runs for minutes; holding a chat request open that long 504s at the
        // HTTP gateway before the work finishes (bit Cole 2026-07-22). Kick it
        // off, answer immediately, and let each ingested unit surface on the
        // Bridge as it lands (ingestDocument already files those signals).
        const scope = domain ? `the ${domain} canon` : "every field's next unit";
        void runCurriculumIngest({ onlyDomain: domain, maxUnits })
          .then(async (res) => {
            if (!res.ok) {
              console.error("[learning] background study failed:", res.error);
              return;
            }
            if (res.studied.length === 0 && res.skipped.length > 0) {
              console.warn("[learning] background study skipped everything:", res.skipped[0]?.reason);
            }
            console.log(
              `[learning] background study done — ${res.studied.length} unit(s)${res.studied.length ? `: ${res.studied.map((s) => s.title).join("; ")}` : ""}`
            );
          })
          .catch((err) => console.error("[learning] background study crashed:", err?.message ?? err));
        return {
          ok: true,
          output: {
            summary: `Study session started on ${scope} (up to ${maxUnits ?? 8} units) — running in the background. Each unit lands on the Bridge as it's ingested; check reading_progress in a few minutes.`,
            background: true,
          },
        };
      }

      default:
        return { ok: false, output: null, error: `unknown learning action: ${action}` };
    }
  },
};
