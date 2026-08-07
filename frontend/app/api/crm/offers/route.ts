import { NextResponse } from "next/server";
import { draftOffer, listOffers, activateOffer, retireOffer, offerReadiness, probeOffer, offerProbeStanding } from "../../../../../aurelius/business/offers";

export const dynamic = "force-dynamic";

/** Offers, and whether anything is actually live for marketing to point at. */
export async function GET() {
  try {
    const [offers, readiness, probe] = await Promise.all([listOffers(), offerReadiness(), offerProbeStanding()]);
    return NextResponse.json({ offers, readiness, probe });
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
      case "probe": {
        // Inward: floats 2–3 draft variants, each behind its own tracked link.
        // Nothing goes live — activating the winner stays Cole's hand.
        const out = await probeOffer({ variants: body.variants });
        if (!out.ok) throw new Error(out.error ?? "Could not start a probe");
        return NextResponse.json(out);
      }
      default:
        throw new Error(`Unknown kind: ${body?.kind}. Expected draft, activate, retire, or probe.`);
    }
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Offer action failed" }, { status: 400 });
  }
}
