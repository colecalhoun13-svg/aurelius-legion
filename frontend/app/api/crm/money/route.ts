import { NextResponse } from "next/server";
import {
  raiseInvoice,
  recordPayment,
  addEngagement,
  logSession,
  updateClient,
  updateEngagement,
} from "../../../../../aurelius/crm/service";
import { expenseSummary, listExpenses } from "../../../../../aurelius/business/expenses";
import { profitAndLoss } from "../../../../../aurelius/business/pnl";

export const dynamic = "force-dynamic";

/**
 * The spend side of the treasury — what this month COST. The honest negative
 * a zero-revenue business needs on screen next to "received". Read-only here;
 * recording an expense is the crm.record_expense tool (chat) — capture-only,
 * nothing deducted or filed anywhere.
 */
export async function GET() {
  try {
    const [expenses, recent, pnl] = await Promise.all([
      expenseSummary(),
      listExpenses({ limit: 10 }),
      // The P&L joins earned − spent = net (the one statement the treasury
      // never actually subtracted). Best-effort: a P&L failure must not take
      // the whole money panel down with it.
      profitAndLoss().catch(() => null),
    ]);
    return NextResponse.json({ expenses, recent, pnl });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Failed to load expenses" }, { status: 500 });
  }
}

/**
 * The money writes, behind one endpoint keyed by `kind`.
 *
 * All three are INWARD book entries. `invoice` records that an amount is OWED
 * — it does not send anything to anyone. Sending is outward and stops for
 * Cole's confirm by construction.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    switch (body?.kind) {
      case "engagement":
        return NextResponse.json(await addEngagement(body));
      case "invoice":
        return NextResponse.json(await raiseInvoice(body));
      case "payment":
        return NextResponse.json(await recordPayment(body));
      // The three writes the service supported and the UI could not reach.
      // A check-in Cole can't log from his phone is a check-in that never
      // gets logged, and an engagement he can't close is the re-sign the
      // risk line nags about with no button to end the nagging.
      case "session": {
        if (!body.clientId) throw new Error("Which client?");
        // `kind` is this endpoint's discriminator, so a session's own kind
        // arrives as `sessionKind` and is renamed here rather than clobbered.
        const { kind, sessionKind, ...rest } = body;
        return NextResponse.json(await logSession({ ...rest, kind: sessionKind }));
      }
      case "client_patch": {
        if (!body.clientId) throw new Error("Which client?");
        const { kind, clientId, ...patch } = body;
        return NextResponse.json(await updateClient(String(clientId), patch));
      }
      case "engagement_patch": {
        if (!body.engagementId) throw new Error("Which engagement?");
        const { kind, engagementId, ...patch } = body;
        return NextResponse.json(await updateEngagement(String(engagementId), patch));
      }
      default:
        throw new Error(
          `Unknown kind: ${body?.kind}. Expected engagement, invoice, payment, session, client_patch, or engagement_patch.`
        );
    }
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Failed to record that" }, { status: 400 });
  }
}
