import { NextResponse } from "next/server";
import { getAllPendingProposals, resolveProposal } from "../../../../aurelius/knowledge/proposals";
import { prisma } from "../../../../aurelius/core/db/prisma";

// DB backed — never statically evaluate at build time.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ proposals: await getAllPendingProposals() });
  } catch (error: any) {
    console.error("Proposals list error:", error);
    return NextResponse.json({ error: error?.message ?? "Failed to load proposals" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { id, decision, correctedValue, note } = body ?? {};
    if (!id || !["confirmed", "denied", "corrected"].includes(decision)) {
      return NextResponse.json({ error: "id + decision (confirmed|denied|corrected) required" }, { status: 400 });
    }
    const row = await prisma.knowledgeProposal.findUnique({ where: { id } });
    if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });

    const resolved = await resolveProposal({
      operatorId: row.operatorId,
      proposalId: id,
      decision,
      coleResponseText: note ?? `${decision} via review surface`,
      correctedValue,
    });
    return NextResponse.json({ proposal: resolved });
  } catch (error: any) {
    console.error("Proposal resolve error:", error);
    return NextResponse.json({ error: error?.message ?? "Resolve failed" }, { status: 500 });
  }
}
