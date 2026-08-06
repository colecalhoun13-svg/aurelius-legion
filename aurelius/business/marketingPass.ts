// aurelius/business/marketingPass.ts
//
// THE WEEKLY MARKETING PASS — the invoker the content side didn't have.
//
// Angles, assets and the offer were all pull-only: Aurelius could do the work,
// but only if Cole remembered to open the page and press a button. That is the
// difference between a tool and a second operator, and it is exactly the
// failure hard rule 8 describes — a capability with no invoker.
//
// The hard part is NOT generating content. It is generating almost none.
//
//   • Cole works full time. Every draft costs review time, and a system that
//     produces twenty pieces a week for a man with forty-five spare minutes is
//     a net loss however good the writing is. This produces AT MOST ONE piece
//     per run — roughly four a month.
//   • It refuses to add to a backlog. If there are already 3 unused pieces
//     waiting, the constraint is his attention, not supply, and writing more
//     would be the system talking to itself.
//   • It refuses to write at all with no live offer. Content pointing at
//     nothing generates conversations he cannot close, which is worse than
//     silence — it burns the warm audience he is trying to build.
//
// Everything here is INWARD. It writes a draft into the queue. Publishing is
// `content.publish`, outward, always Cole's tap.

import { surfaceSignal } from "../core/bridge.ts";
import { MARKETING_FORMATS, type MarketingFormat } from "./marketing.ts";

/** Never add to a pile Cole hasn't worked through. His attention is the cap. */
const BACKLOG_CEILING = 3;

export type MarketingPassResult = {
  ran: boolean;
  reason: string;
  draftId?: string;
  angle?: string;
  format?: string;
};

export async function runMarketingPass(): Promise<MarketingPassResult> {
  const { offerReadiness } = await import("./offers.ts");
  const { queueState, saveDraft } = await import("../content/queue.ts");
  const { anglePerformance, proposeAngles, draftAsset } = await import("./marketing.ts");

  // 1. Nothing to sell → say that, and write nothing.
  const offer = await offerReadiness();
  if (!offer.hasActive) {
    await surfaceSignal({
      kind: "recommendation",
      domain: "business",
      sourceType: "marketing_pass",
      // Deduped by source id: this is a standing condition, not weekly news.
      sourceId: "marketing:no_offer",
      severity: "attention",
      title: "No offer — so nothing to write toward",
      body:
        `${offer.headline}\n\nI'm not drafting content this week: a post that points at nothing ` +
        `starts conversations you can't close, and it spends the small warm audience you're building. ` +
        `Define and price one offer, and I'll write toward it from next week.`,
    }).catch(() => {});
    return { ran: false, reason: "no_offer" };
  }

  // 2. Backlog → the constraint is his review time, not supply.
  const queue = await queueState();
  const unused = queue.draft + queue.ready;
  if (unused >= BACKLOG_CEILING) {
    return { ran: false, reason: `backlog:${unused}` };
  }

  // 3. Pick the angle his own results favour. Leads first — that number
  //    arrives on its own; replies have to be remembered and typed in.
  let perf = await anglePerformance();
  if (perf.angles.length === 0) {
    const proposed = await proposeAngles({ count: 3 });
    if (!proposed.ok) return { ran: false, reason: "no_engine" };
    perf = await anglePerformance();
  }
  const candidates = perf.angles.filter((a) => a.status !== "retired");
  if (candidates.length === 0) return { ran: false, reason: "no_angles" };

  const best = [...candidates].sort((a, b) => {
    if (b.leads !== a.leads) return b.leads - a.leads;
    if (b.replies !== a.replies) return b.replies - a.replies;
    // Never used beats used-and-ignored: an untested idea still has
    // information in it, one that's been sent ten times with no reply doesn't.
    return a.timesUsed - b.timesUsed;
  })[0]!;

  // 4. Rotate the format deterministically off what's already been written,
  //    so four weeks produce four different shapes rather than four captions.
  const format = MARKETING_FORMATS[
    (queue.published + queue.draft + queue.ready + queue.staged) % MARKETING_FORMATS.length
  ] as MarketingFormat;

  const asset = await draftAsset(best.id, format);
  if (!asset.ok || !asset.body) return { ran: false, reason: "no_engine" };

  // saveDraft re-checks for engine-error text and inherits the angle's real
  // grounding from the database rather than trusting anything passed here.
  const kept = await saveDraft({
    body: asset.body,
    angleId: best.id,
    format,
    title: best.title,
    channel: format.startsWith("instagram") ? "instagram" : format === "email" ? "email" : "other",
  });
  if (!kept.ok) return { ran: false, reason: kept.error ?? "not_kept" };

  await surfaceSignal({
    kind: "recommendation",
    domain: "content",
    sourceType: "marketing_pass",
    sourceId: `marketing:draft:${kept.id}`,
    severity: "info",
    title: `One ${format.replace(/_/g, " ")} ready for the week`,
    body:
      `Written from "${best.title}" — ${best.verdict}.\n\n` +
      (best.grounding === "none"
        ? "The idea underneath it is an unverified guess, not a finding. Treat it as a test.\n\n"
        : "") +
      `It's a draft in the queue. Edit it into your words, then publish when you're happy — ` +
      `I don't post anything on my own.`,
  }).catch(() => {});

  return { ran: true, reason: "drafted", draftId: kept.id, angle: best.title, format };
}
