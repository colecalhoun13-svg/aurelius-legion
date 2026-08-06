import { NextResponse } from "next/server";
import { proposeAngles, draftAsset, recordOutcome, anglePerformance } from "../../../../../aurelius/business/marketing";

export const dynamic = "force-dynamic";

/**
 * Marketing writes from the Business page.
 *
 * These existed as chat tools only, which meant the engine was unreachable
 * from the surface Cole actually opens — the defect CLAUDE.md rule 8 exists
 * to catch. All of it is INWARD: it proposes and drafts. Publishing is
 * `content.publish` and sending is `outreach.send`, both outward, neither
 * reachable from here.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    switch (body?.kind) {
      case "propose": {
        const out = await proposeAngles({ count: Number(body.count) || undefined, audience: body.audience });
        if (!out.ok) throw new Error(out.error ?? "Could not propose angles");
        return NextResponse.json(out);
      }
      case "draft": {
        if (!body.angleId) throw new Error("Which angle?");
        const out = await draftAsset(String(body.angleId), body.format);
        if (!out.ok) throw new Error(out.error ?? "Draft failed");
        return NextResponse.json(out);
      }
      case "outcome": {
        if (!body.angleId) throw new Error("Which angle?");
        const out = await recordOutcome(body);
        if (!out.ok) throw new Error(out.error ?? "Could not record that");
        return NextResponse.json(await anglePerformance());
      }
      default:
        throw new Error(`Unknown kind: ${body?.kind}. Expected propose, draft, or outcome.`);
    }
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Marketing action failed" }, { status: 400 });
  }
}
