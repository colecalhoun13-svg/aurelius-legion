// aurelius/crm/ledger.ts
//
// THE MONEY LEDGER — earned money, traced to what earned it.
//
// There is deliberately NO MoneyEvent table. The schema already separates
// Invoice (owed) from Payment (received), and "earned" is not a stored flag —
// it is the sum of Payment, money that actually ARRIVED. A parallel money-state
// row would duplicate that and re-introduce the stored-state dishonesty the
// Invoice/Payment split exists to avoid ("overdue is derived, never stored").
//
// So earnedCents is a CODE INVARIANT here: it sums Payment and nothing else. A
// drafted invoice, a committed engagement, an MRR projection — none of it is
// earned until a Payment row says it arrived. The attribution rollup credits
// that arrived money to the channel and angle that produced the client, via the
// Payment → Client → Lead → angle chain, so Cole can finally see which of his
// marketing actually earns rather than which merely produces conversations.

import { prisma } from "../core/db/prisma.ts";
import { fromCents } from "./service.ts";

export type MoneyLedger = {
  earnedCents: number; // sum of Payment — money that arrived. The invariant.
  earned: string;
  earnedThisMonthCents: number;
  earnedThisMonth: string;
  paymentCount: number;
  // Earned, split by the channel/angle that produced the paying client.
  byChannel: Array<{ channel: string; cents: number; label: string }>;
  byAngle: Array<{ angle: string; cents: number; label: string }>;
  // Provenance: how each dollar was recorded. selfRecorded is money Aurelius
  // logged on its own (a Stripe webhook, a parsed Venmo email) vs Cole's hand.
  recordedBy: Array<{ by: string; cents: number; count: number }>;
  selfRecordedCents: number;
  headline: string;
};

export async function moneyLedger(now = new Date()): Promise<MoneyLedger> {
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [payments, monthAgg, byRecordedByRows] = await Promise.all([
    prisma.payment.findMany({
      select: {
        amountCents: true,
        recordedBy: true,
        client: {
          select: {
            lead: { select: { source: true, angle: { select: { title: true } } } },
          },
        },
      },
    }),
    prisma.payment.aggregate({ where: { receivedAt: { gte: monthStart } }, _sum: { amountCents: true } }),
    prisma.payment.groupBy({ by: ["recordedBy"], _sum: { amountCents: true }, _count: { _all: true } }),
  ]);

  const earnedCents = payments.reduce((s, p) => s + p.amountCents, 0);

  const channelCents: Record<string, number> = {};
  const angleCents: Record<string, number> = {};
  for (const p of payments) {
    // A client with no lead behind it is money that arrived unattributed — an
    // honest bucket, not zero. (Cole recorded a cash payment for someone he
    // never logged as a lead, say.)
    const channel = p.client?.lead?.source ?? "unattributed";
    channelCents[channel] = (channelCents[channel] ?? 0) + p.amountCents;
    const angle = p.client?.lead?.angle?.title;
    if (angle) angleCents[angle] = (angleCents[angle] ?? 0) + p.amountCents;
  }

  const byChannel = Object.entries(channelCents)
    .sort((a, b) => b[1] - a[1])
    .map(([channel, cents]) => ({ channel, cents, label: fromCents(cents) }));
  const byAngle = Object.entries(angleCents)
    .sort((a, b) => b[1] - a[1])
    .map(([angle, cents]) => ({ angle, cents, label: fromCents(cents) }));

  const recordedBy = byRecordedByRows
    .map((r) => ({ by: r.recordedBy, cents: r._sum.amountCents ?? 0, count: r._count._all }))
    .sort((a, b) => b.cents - a.cents);
  const selfRecordedCents = recordedBy.filter((r) => r.by !== "cole").reduce((s, r) => s + r.cents, 0);

  const earnedThisMonthCents = monthAgg._sum.amountCents ?? 0;

  return {
    earnedCents,
    earned: fromCents(earnedCents),
    earnedThisMonthCents,
    earnedThisMonth: fromCents(earnedThisMonthCents),
    paymentCount: payments.length,
    byChannel,
    byAngle,
    recordedBy,
    selfRecordedCents,
    headline:
      earnedCents === 0
        ? "Nothing earned yet — no payment has arrived. Every dollar here is real money in the account, not a projection, so this stays at zero until one does."
        : `${fromCents(earnedCents)} earned all-time · ${fromCents(earnedThisMonthCents)} this month` +
          (byChannel.length > 0 && byChannel[0]!.channel !== "unattributed"
            ? ` · best channel: ${byChannel[0]!.channel} (${byChannel[0]!.label})`
            : ""),
  };
}
