import { NextResponse } from "next/server";
import { clientRetentionView, logMetric, draftProofContent, draftClientMessage } from "../../../../../aurelius/crm/retention";

export const dynamic = "force-dynamic";

// The retention surface for a client: PR ledger, check-in cadence, referrals,
// and the inward drafts (proof content, check-in / re-sign / referral message).
// Every draft is inward — it writes copy for Cole to review and send himself.

export async function GET(request: Request) {
  try {
    const clientId = new URL(request.url).searchParams.get("clientId");
    if (!clientId) return NextResponse.json({ error: "clientId is required" }, { status: 400 });
    const view = await clientRetentionView(clientId);
    if (!view) return NextResponse.json({ error: "no such client" }, { status: 404 });
    return NextResponse.json(view);
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Failed to load retention" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const clientId = String(body?.clientId ?? "");
    if (!clientId) throw new Error("Which client?");
    switch (body?.kind) {
      case "metric": {
        const value = Number(body.value);
        if (!body.label || !Number.isFinite(value)) throw new Error("A metric needs a label and a number.");
        const out = await logMetric({ clientId, label: String(body.label), value, unit: body.unit ? String(body.unit) : undefined, source: "coach" });
        return NextResponse.json(out);
      }
      case "proof": {
        const out = await draftProofContent(clientId);
        if (!out.ok) throw new Error(out.error ?? "Could not draft proof");
        return NextResponse.json(out);
      }
      case "checkin":
      case "resign":
      case "referral": {
        const out = await draftClientMessage(clientId, body.kind);
        if (!out.ok) throw new Error(out.error ?? "Could not draft");
        return NextResponse.json(out);
      }
      default:
        throw new Error(`Unknown kind: ${body?.kind}. Expected metric, proof, checkin, resign, or referral.`);
    }
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Retention action failed" }, { status: 400 });
  }
}
