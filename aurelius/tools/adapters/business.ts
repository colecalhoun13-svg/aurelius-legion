// aurelius/tools/adapters/business.ts
//
// The business foundation, drivable from chat. Read-and-elicit only —
// nothing outward, nothing published. Offers land as proposals for Cole's
// confirm (an offer is his decision by construction).

import type { ToolAdapter, ToolAdapterResult } from "../types.ts";

export const businessAdapter: ToolAdapter = {
  name: "business",
  description:
    "Cole's business foundation: what's confirmed, what's still unknown, and drafting an offer from the confirmed facts. Pre-offer by design — it elicits Cole's truth, never invents it.",
  actions: [
    {
      name: "snapshot",
      description:
        "Where the business actually stands: confirmed facts, open questions, and what each gap is blocking. Use when Cole asks about his business, positioning, offers, or 'what do you know about my business'.",
      dataSchema: "{}",
      example: "[TOOL: tool=business action=snapshot data={}]",
    },
    {
      name: "next_question",
      description:
        "The single most-unblocking thing Aurelius doesn't know yet, phrased as one direct question. Use when Cole asks what you need from him, or when a business answer is blocked by a gap.",
      dataSchema: "{}",
      example: "[TOOL: tool=business action=next_question data={}]",
    },
    {
      name: "answer",
      description:
        "Record Cole's answer to one of the open business questions. His own truth about his own business — applies immediately, no confirm round-trip.",
      dataSchema: '{ "key": string (the question key from snapshot/next_question), "answer": string }',
      example: '[TOOL: tool=business action=answer data={"key": "capacity", "answer": "10 athletes, about 12 hours a week"}]',
    },
    {
      name: "draft_offer",
      description:
        "Draft an offer from the confirmed facts and file it as a proposal for Cole to confirm/correct/deny. Refuses honestly (naming what to ask first) while blocking gaps are open.",
      dataSchema: "{}",
      example: "[TOOL: tool=business action=draft_offer data={}]",
    },
  ],
  async run(action, data): Promise<ToolAdapterResult> {
    const P = await import("../../business/positioning.ts");
    try {
      if (action === "snapshot") {
        const snap = await P.businessSnapshot();
        return { ok: true, output: snap };
      }
      if (action === "next_question") {
        const gaps = await P.openGaps();
        if (gaps.length === 0) {
          return { ok: true, output: { question: null, summary: "Nothing outstanding — every business question is answered." } };
        }
        const q = gaps[0]!;
        return {
          ok: true,
          output: { key: q.key, question: q.question, blocks: q.blocks, remaining: gaps.length, summary: q.question },
        };
      }
      if (action === "answer") {
        const key = (data?.key ?? "").toString().trim();
        const answer = (data?.answer ?? "").toString().trim();
        const r = await P.recordGapAnswer(key, answer);
        if (!r.ok) return { ok: false, output: null, error: r.error ?? "could not record that" };
        const left = (await P.openGaps()).length;
        return { ok: true, output: { recorded: key, openQuestionsLeft: left, summary: `Filed under business.${key}. ${left} question(s) left.` } };
      }
      if (action === "draft_offer") {
        // Backend tsconfig runs non-strict, so discriminated-union narrowing
        // isn't reliable here — read the shape explicitly instead.
        const r: any = await P.proposeOffer();
        if (!r?.ok) {
          return { ok: false, output: { askFirst: r?.askFirst ?? [] }, error: r?.error ?? "could not draft an offer" };
        }
        return {
          ok: true,
          output: { offer: r.proposal, proposalId: r.proposalId, summary: "Offer drafted — it's on the Bridge for your confirm, correction, or bin." },
        };
      }
      return { ok: false, output: null, error: `unknown business action: ${action}` };
    } catch (e: any) {
      return { ok: false, output: null, error: e?.message ?? "business tool failed" };
    }
  },
};
