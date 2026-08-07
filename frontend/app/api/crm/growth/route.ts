import { NextResponse } from "next/server";
import { stripeConfigured } from "../../../../../aurelius/crm/selfRecord";
import { twilioConfigured } from "../../../../../aurelius/crm/sms";
import { paidAdsConfigured, boostStanding, proposeBoost, stageBoost } from "../../../../../aurelius/business/paidBoost";
import { researchPartners, draftPartnerIntro } from "../../../../../aurelius/business/partnership";
import { retentionAnalytics } from "../../../../../aurelius/crm/retention";

export const dynamic = "force-dynamic";

// The growth surface: which integrations are connected, where the paid
// experiment stands, and the partnership pipeline. Config-gated pieces report
// their honest state (connected vs "set the key") rather than pretending.

export async function GET() {
  try {
    const [boost, analytics] = await Promise.all([boostStanding(), retentionAnalytics()]);
    return NextResponse.json({
      integrations: {
        stripe: stripeConfigured(),
        twilio: twilioConfigured(),
        paidAds: paidAdsConfigured(),
      },
      boost,
      analytics,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Failed to load growth" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    switch (body?.kind) {
      case "research_partners": {
        const out = await researchPartners();
        return NextResponse.json(out);
      }
      case "partner_intro": {
        const out = await draftPartnerIntro({ name: String(body.name ?? ""), handle: body.handle, angle: body.angle });
        if (!out.ok) throw new Error(out.error ?? "Could not draft an intro");
        return NextResponse.json(out);
      }
      case "propose_boost": {
        const out = await proposeBoost({ budgetCents: body.budgetCents, killCplCents: body.killCplCents });
        return NextResponse.json(out);
      }
      case "stage_boost": {
        // Stage the spend → GATE for Cole's confirm (ads.spend is outward). The
        // spend never happens here; it files a pending Bridge confirm.
        const out = await stageBoost({ budgetCents: body.budgetCents, killCplCents: body.killCplCents });
        if (!out.ok) throw new Error(out.reason);
        return NextResponse.json(out);
      }
      default:
        throw new Error(`Unknown kind: ${body?.kind}.`);
    }
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Growth action failed" }, { status: 400 });
  }
}
