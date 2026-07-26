import { NextResponse } from "next/server";

// One number the chrome can poll cheaply: how many things await Cole's
// ruling (pending/surfaced Bridge signals + pending knowledge proposals).
// This is what the bell, the tab badge, and the PWA icon badge all show.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { prisma } = await import("../../../../../aurelius/core/db/prisma");
    const [signals, proposals] = await Promise.all([
      prisma.bridgeSignal.count({ where: { status: { in: ["pending", "surfaced"] } } }),
      prisma.knowledgeProposal.count({ where: { status: "pending" } }),
    ]);
    return NextResponse.json({ needsYou: signals + proposals, signals, proposals });
  } catch (error: any) {
    // Badge is a nicety — a failed count must never error the chrome.
    return NextResponse.json({ needsYou: 0, signals: 0, proposals: 0, degraded: true });
  }
}
