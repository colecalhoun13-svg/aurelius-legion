import { NextResponse } from "next/server";

// One number the chrome can poll cheaply: how many things await Cole's
// RULING — pending knowledge proposals + Bridge signals that are genuinely
// decisions (carry a button, or are a risk/opportunity/gap Cole must weigh).
// This is what the bell, the tab badge, and the PWA icon badge all show.
//
// A receipt that leaked into "pending" (a direct bridgeSignal.create that
// skipped surfaceSignal's routing) must NOT ring the bell — a bell that means
// "something happened" gets muted, and the real decisions are lost with it.
// needsDecision is the exact predicate getDeck splits on, so the badge and the
// Decisions surface can never disagree about the count.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { prisma } = await import("../../../../../aurelius/core/db/prisma");
    const { needsDecision } = await import("../../../../../aurelius/core/bridge");
    const [openSignals, proposals] = await Promise.all([
      prisma.bridgeSignal.findMany({
        where: { status: { in: ["pending", "surfaced"] } },
        select: { kind: true, severity: true, actions: true },
      }),
      prisma.knowledgeProposal.count({ where: { status: "pending" } }),
    ]);
    const signals = openSignals.filter((s) =>
      needsDecision({ kind: s.kind, severity: s.severity ?? undefined, actions: s.actions })
    ).length;
    return NextResponse.json({ needsYou: signals + proposals, signals, proposals });
  } catch (error: any) {
    // Badge is a nicety — a failed count must never error the chrome.
    return NextResponse.json({ needsYou: 0, signals: 0, proposals: 0, degraded: true });
  }
}
