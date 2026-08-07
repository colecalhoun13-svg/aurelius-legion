// aurelius/business/analyst.ts
//
// THE CONFRONTING ANALYST — one true sentence a week, never a dashboard.
//
// The attribution spine records clicks, leads and earned money per channel. This
// reads it and says the single most useful thing: not "here are your numbers"
// (Cole can read numbers) but "here is what your numbers MEAN and what to do."
//
// Two rules keep it honest:
//   1. THE REAL-DENOMINATOR RULE. A channel is not ranked on one data point. A
//      channel that produced a single lead is not "your best channel" — it is a
//      coin flip. Below a real threshold, the honest verdict is "too early",
//      said out loud, never a rate computed from n=1.
//   2. IT CONFRONTS. When traffic lands and doesn't convert, or leads come and
//      never close, that is the sentence — because that is the money leak. A
//      cheerful "instagram is winning" over three leads would be a lie of
//      omission about the thing actually costing him.
//
// Spend per channel is $0 today (no paid ads yet) and the ROI field is wired for
// when Wave 5's measured boost starts writing it — earned ÷ spend needs no
// rework then. Effort is measured as leads-to-review (a real, countable unit),
// not invented minutes.

import { prisma } from "../core/db/prisma.ts";
import { moneyLedger } from "../crm/ledger.ts";
import { fromCents } from "../crm/service.ts";

const MIN_CLICKS_TO_RANK = 15;
const MIN_LEADS_TO_RANK = 3;

export type ChannelStat = {
  channel: string;
  clicks: number;
  leads: number;
  replies: number;
  earnedCents: number;
  spentCents: number; // 0 until Wave 5 paid boost writes it
  conversionPct: number | null; // leads ÷ clicks, null when clicks < threshold
  earnedPerLeadCents: number | null;
  ranked: boolean; // has enough data to be judged
};

export async function channelPerformance(): Promise<ChannelStat[]> {
  const [events, ledger] = await Promise.all([
    prisma.attributionEvent.groupBy({ by: ["channel", "kind"], _count: { _all: true } }),
    moneyLedger(),
  ]);

  const earnedByChannel = new Map(ledger.byChannel.map((c) => [c.channel, c.cents]));
  const channels = new Set<string>([
    ...events.map((e) => e.channel),
    ...ledger.byChannel.map((c) => c.channel),
  ]);

  const stats: ChannelStat[] = [];
  for (const channel of channels) {
    if (channel === "unattributed") continue; // real channels only
    const countOf = (kind: string) =>
      events.filter((e) => e.channel === channel && e.kind === kind).reduce((s, e) => s + e._count._all, 0);
    const clicks = countOf("click");
    const leads = countOf("intake") + countOf("inbound");
    const replies = countOf("reply");
    const earnedCents = earnedByChannel.get(channel) ?? 0;
    const ranked = clicks >= MIN_CLICKS_TO_RANK || leads >= MIN_LEADS_TO_RANK;
    stats.push({
      channel,
      clicks,
      leads,
      replies,
      earnedCents,
      spentCents: 0,
      conversionPct: clicks >= MIN_CLICKS_TO_RANK ? Math.round((leads / clicks) * 100) : null,
      earnedPerLeadCents: leads > 0 ? Math.round(earnedCents / leads) : null,
      ranked,
    });
  }
  // Earned first, then leads, then clicks — the order of what matters.
  return stats.sort((a, b) => b.earnedCents - a.earnedCents || b.leads - a.leads || b.clicks - a.clicks);
}

export type AnalystRead = {
  truth: string; // the one confronting sentence
  ranked: ChannelStat[];
  tooEarly: ChannelStat[];
  hasData: boolean;
};

/** The one truth for the week. Deterministic priority: name the leak before the
 *  win, and refuse to crown a winner on too little data. */
export async function businessAnalystRead(): Promise<AnalystRead> {
  const stats = await channelPerformance();
  const ranked = stats.filter((s) => s.ranked);
  const tooEarly = stats.filter((s) => !s.ranked);
  const anyClicks = stats.some((s) => s.clicks > 0);
  const anyLeads = stats.some((s) => s.leads > 0);
  const hasData = anyClicks || anyLeads;

  let truth: string;
  if (!hasData) {
    truth =
      "Nothing is being measured yet — no tracked link has been clicked and no lead carries a channel. " +
      "The analyst can't rank what doesn't exist. Get one link in front of real people this week; that's the whole job right now.";
  } else {
    // 1. Traffic that doesn't convert — the sharpest leak.
    const leaky = ranked.find((s) => s.clicks >= MIN_CLICKS_TO_RANK && s.leads === 0);
    // 2. Leads that don't close.
    const stalling = ranked.find((s) => s.leads >= MIN_LEADS_TO_RANK && s.earnedCents === 0);
    // 3. A real earned leader.
    const earner = ranked.find((s) => s.earnedCents > 0);
    // 4. A conversion leader before any money.
    const converter = [...ranked].filter((s) => s.conversionPct != null).sort((a, b) => (b.conversionPct! - a.conversionPct!))[0];

    if (leaky) {
      truth =
        `${leaky.channel} sent ${leaky.clicks} clicks and produced zero leads. The traffic is real; the page or the offer isn't catching it. ` +
        `Fix what happens after the click before you chase more of them.`;
    } else if (stalling) {
      truth =
        `${stalling.channel} produced ${stalling.leads} leads and $0 earned. The conversations are happening — the close isn't. ` +
        `That's a sales problem, not a lead problem, and more leads won't fix it.`;
    } else if (earner) {
      truth =
        `${earner.channel} has earned the most — ${fromCents(earner.earnedCents)} from ${earner.leads} lead${earner.leads === 1 ? "" : "s"}. ` +
        `That's the channel that actually pays. Feed it before anything new.`;
    } else if (converter && converter.conversionPct != null) {
      truth =
        `${converter.channel} converts best so far — ${converter.conversionPct}% of clicks become leads. No money yet, but it's the cheapest yard on the field. Lean in.`;
    } else {
      truth =
        `There's traffic but not enough of it to call a winner yet — no channel has cleared ${MIN_CLICKS_TO_RANK} clicks or ${MIN_LEADS_TO_RANK} leads. ` +
        `Keep the links flowing; the read gets real once the numbers do.`;
    }
  }

  return { truth, ranked, tooEarly, hasData };
}
