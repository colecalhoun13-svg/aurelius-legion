// aurelius/tools/adapters/corpus.ts
//
// The library's front desk from chat. Semantic questions already flow through
// recall and /ask; what was missing (council, 2026-07-19) is the LISTING view —
// "what landed in the corpus recently / what did my drop just ingest" — which
// is a database question, not a retrieval one.

import type { ToolAdapter, ToolAdapterResult } from "../types.ts";

export const corpusAdapter: ToolAdapter = {
  name: "corpus",
  description:
    "The second brain's library inventory: list recently ingested documents (drops, transcripts, research) with source and domain.",
  actions: [
    {
      name: "list_recent",
      description:
        "List the most recently ingested corpus documents — titles, domains, sources, dates. Use when Cole asks what's new in the library or whether a drop landed.",
      dataSchema: '{ "limit"?: number (default 10, max 30) }',
      example: '[TOOL: tool=corpus action=list_recent data={"limit": 10}]',
    },
    {
      name: "forget",
      description:
        "Remove a document from the second brain entirely (embeddings, memory, mirror) — ONLY when Cole explicitly asks to forget/delete it. Ambiguous titles delete nothing and return candidates.",
      dataSchema: '{ "document": string (id or title fragment) }',
      example: '[TOOL: tool=corpus action=forget data={"document": "old speed manual"}]',
    },
  ],
  async run(action, data): Promise<ToolAdapterResult> {
    if (action === "list_recent") {
      try {
        const limit = Math.min(Math.max(Number(data?.limit) || 10, 1), 30);
        const { listCorpus } = await import("../../corpus/ingest.ts");
        const docs = await listCorpus(limit);
        return {
          ok: true,
          output: {
            documents: docs.map((d) => ({
              title: d.title,
              domain: d.domain,
              sourceType: d.sourceType,
              ingested: d.createdAt,
              summary: d.summary,
            })),
            summary: `${docs.length} most recent corpus documents`,
          },
        };
      } catch (e: any) {
        return { ok: false, output: null, error: e?.message ?? "corpus listing failed" };
      }
    }
    if (action === "forget") {
      const ref = (data?.document ?? "").toString().trim();
      if (!ref) return { ok: false, output: null, error: "corpus.forget needs a document id or title" };
      try {
        const { forgetDocument } = await import("../../corpus/ingest.ts");
        const r = await forgetDocument(ref);
        if (!r.forgotten || !r.doc) {
          return {
            ok: false,
            output: { matches: r.matches },
            error:
              r.matches.length > 0
                ? `${r.reason}: ${r.matches.map((m) => `"${m.title}" (${m.domain})`).join(", ")}`
                : r.reason ?? "forget failed",
          };
        }
        return {
          ok: true,
          output: { forgotten: r.doc, summary: `Forgot "${r.doc.title}" — removed from recall, memory, and the vault.` },
        };
      } catch (e: any) {
        return { ok: false, output: null, error: e?.message ?? "forget failed" };
      }
    }
    return { ok: false, output: null, error: `unknown corpus action: ${action}` };
  },
};
