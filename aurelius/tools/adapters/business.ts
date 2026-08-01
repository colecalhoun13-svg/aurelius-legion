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
        "Draft an offer from the confirmed facts and file it as a proposal for Cole to confirm/correct/deny. Unknowns are marked as assumptions in the draft — never a reason to refuse.",
      dataSchema: "{}",
      example: "[TOOL: tool=business action=draft_offer data={}]",
    },
    {
      name: "aim_research",
      description:
        "Re-point the Sunday research sweep at Cole's actual situation, derived from his confirmed facts and current top unknown. Use after his business facts change materially.",
      dataSchema: "{}",
      example: "[TOOL: tool=business action=aim_research data={}]",
    },
    {
      name: "options",
      description:
        "THE DEFAULT for any marketing/growth/positioning question. Runs live research, then gives THREE genuinely different approaches grounded in Cole's facts — what each demands, where each fails, how to test it cheap. Deliberately does not converge on one recommendation: Cole decides, Aurelius informs. Use this instead of prescribing an answer.",
      dataSchema: '{ "question": string (what he\'s weighing — e.g. "how do I get more high school athletes into the gym") }',
      example: '[TOOL: tool=business action=options data={"question": "how should I get more varsity athletes in the door"}]',
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
      if (action === "aim_research") {
        const t = await P.deriveStandingTopics();
        return {
          ok: true,
          output: {
            business: t.business,
            content: t.content,
            summary: `Research lane re-aimed: ${t.business.length} business topic(s), ${t.content.length} content topic(s). The Sunday sweep works these from now on.`,
          },
        };
      }
      if (action === "options") {
        const r: any = await P.marketingOptions((data?.question ?? "").toString());
        if (!r?.ok) return { ok: false, output: null, error: r?.error ?? "could not explore that" };
        return {
          ok: true,
          output: {
            options: r.options,
            grounding: r.grounding,
            summary: `Three approaches, ${r.grounding === "external" ? "research-grounded" : "from Aurelius's own knowledge (no external source retrieved)"} — Cole's call.`,
          },
        };
      }
      return { ok: false, output: null, error: `unknown business action: ${action}` };
    } catch (e: any) {
      return { ok: false, output: null, error: e?.message ?? "business tool failed" };
    }
  },
};
