import { NextResponse } from "next/server";
import { athletePerformance, resolveAthleteSheet } from "../../../../../aurelius/crm/performance";
import { setTarget, dropTarget } from "../../../../../aurelius/crm/targets";
import { updateClient } from "../../../../../aurelius/crm/service";
import { sessionFeedbackForAthlete } from "../../../../../aurelius/training/sessionFeedback";

// One athlete's full performance view — identity, per-metric time series
// (trend lines, not adjectives), targets with derived pace, session history,
// the PR ledger, and the program-sheet link. POST carries the panel's four
// inward writes: set/drop a target, link a sheet (server-validated Google
// Sheets URL; empty clears), or find the sheet in Drive (dormant-honest —
// no Google auth returns a reason, never a fake link).
// DB-backed — never statically evaluate at build time.
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const view = await athletePerformance(params.id);
    if (!view) return NextResponse.json({ error: "no such athlete" }, { status: 404 });
    return NextResponse.json(view);
  } catch (error: any) {
    console.error("Athlete performance API error:", error);
    return NextResponse.json({ error: error?.message ?? "Failed to load the athlete" }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const body = await request.json();
    const clientId = params.id;
    switch (body?.action) {
      case "setTarget": {
        const targetValue = Number(body.targetValue);
        if (!Number.isFinite(targetValue)) throw new Error("A target needs a number.");
        const target = await setTarget({
          clientId,
          label: String(body.label ?? ""),
          targetValue,
          unit: body.unit ? String(body.unit) : undefined,
          targetDate: body.targetDate ? String(body.targetDate) : undefined,
          note: body.note ? String(body.note) : undefined,
        });
        return NextResponse.json({ id: target.id });
      }
      case "dropTarget": {
        const targetId = String(body?.targetId ?? "");
        if (!targetId) throw new Error("Which target?");
        await dropTarget(targetId);
        return NextResponse.json({ ok: true });
      }
      case "linkSheet": {
        // Empty string clears; the server validates real Google Sheets URLs.
        await updateClient(clientId, { sheetUrl: String(body?.sheetUrl ?? "") });
        return NextResponse.json({ ok: true });
      }
      case "findSheet": {
        const out = await resolveAthleteSheet(clientId);
        return NextResponse.json(out);
      }
      case "sessionFeedback": {
        // Reads the sheet's latest session, reasons over it, writes the
        // Feedback tab. ok:false carries an honest dormant reason verbatim.
        const out = await sessionFeedbackForAthlete(clientId);
        return NextResponse.json(out);
      }
      default:
        throw new Error(`Unknown action: ${body?.action}. Expected setTarget, dropTarget, linkSheet, findSheet, or sessionFeedback.`);
    }
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Athlete action failed" }, { status: 400 });
  }
}
