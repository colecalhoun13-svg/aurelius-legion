import { NextResponse } from "next/server";
import { raiseInvoice, recordPayment, addEngagement } from "../../../../../aurelius/crm/service";

export const dynamic = "force-dynamic";

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
      default:
        throw new Error(`Unknown kind: ${body?.kind}. Expected engagement, invoice, or payment.`);
    }
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Failed to record that" }, { status: 400 });
  }
}
