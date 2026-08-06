import { NextResponse } from "next/server";
import { draftOffer, listOffers, activateOffer, retireOffer, offerReadiness } from "../../../../../aurelius/business/offers";

export const dynamic = "force-dynamic";

/** Offers, and whether anything is actually live for marketing to point at. */
export async function GET() {
  try {
    const [offers, readiness] = await Promise.all([listOffers(), offerReadiness()]);
    return NextResponse.json({ offers, readiness });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Failed to load offers" }, { status: 500 });
  }
}

/**
 * Drafting is inward and reversible. ACTIVATING is Cole's decision and is
 * never taken by a scheduled job — it is the moment a draft becomes the thing
 * strangers are told he sells, and it refuses without a price he set himself.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    switch (body?.kind) {
      case "draft": {
        const out = await draftOffer({ shape: body.shape });
        if (!out.ok) throw new Error(out.error ?? "Could not draft an offer");
        return NextResponse.json(out);
      }
      case "activate": {
        if (!body.offerId) throw new Error("Which offer?");
        const cents = Math.round(Number(body.price) * 100);
        if (!Number.isFinite(cents) || cents <= 0) throw new Error("Enter the price you'd actually charge.");
        const out = await activateOffer(String(body.offerId), { priceCents: cents });
        if (!out.ok) throw new Error(out.error ?? "Could not activate");
        return NextResponse.json(out);
      }
      case "retire": {
        if (!body.offerId) throw new Error("Which offer?");
        const out = await retireOffer(String(body.offerId));
        if (!out.ok) throw new Error(out.error ?? "Could not retire");
        return NextResponse.json(out);
      }
      default:
        throw new Error(`Unknown kind: ${body?.kind}. Expected draft, activate, or retire.`);
    }
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Offer action failed" }, { status: 400 });
  }
}
