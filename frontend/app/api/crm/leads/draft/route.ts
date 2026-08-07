import { NextResponse } from "next/server";
import { draftOutreach, runOutreachSweep, importWarmList } from "../../../../../../aurelius/crm/leadEngine";

export const dynamic = "force-dynamic";

/** Lead-acquisition writes: one draft, a full sweep, or a warm-list import. */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    switch (body?.kind) {
      case "warm_list": {
        if (!Array.isArray(body.entries) || body.entries.length === 0) {
          throw new Error("Paste at least one person — a name per line is enough.");
        }
        return NextResponse.json(await importWarmList(body.entries, { source: body.source }));
      }
      case "sweep":
        return NextResponse.json(await runOutreachSweep({ max: Number(body.max) || undefined }));
      case "draft": {
        if (!body.leadId) throw new Error("Which lead?");
        const out = await draftOutreach(String(body.leadId));
        if (!out.ok) throw new Error(out.error ?? "Draft failed");
        return NextResponse.json(out);
      }
      default:
        throw new Error(`Unknown kind: ${body?.kind}`);
    }
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Failed" }, { status: 400 });
  }
}
