import { NextResponse } from "next/server";
import {
  pipelineSnapshot,
  whatNeedsAttention,
  listClients,
  listLeads,
} from "../../../../aurelius/crm/service";
import { anglePerformance } from "../../../../aurelius/business/marketing";
import { listOffers, offerReadiness, offerProbeStanding } from "../../../../aurelius/business/offers";
import { listDrafts, queueState } from "../../../../aurelius/content/queue";
import { moneyLedger } from "../../../../aurelius/crm/ledger";
import { listTrackLinks } from "../../../../aurelius/crm/trackLinks";
import { businessAnalystRead } from "../../../../aurelius/business/analyst";

// DB-backed — never statically evaluate at build time.
export const dynamic = "force-dynamic";

/** Everything the Business page needs, in one round trip. */
export async function GET() {
  try {
    const [pipeline, attention, clients, leads, marketing, offers, offerState, drafts, contentState, ledger, probe, trackLinks, analyst] =
      await Promise.all([
        pipelineSnapshot(),
        whatNeedsAttention(14),
        listClients({}),
        listLeads({ limit: 200 }),
        anglePerformance(),
        listOffers(),
        offerReadiness(),
        listDrafts({}),
        queueState(),
        moneyLedger(),
        offerProbeStanding(),
        listTrackLinks({ limit: 20 }),
        businessAnalystRead(),
      ]);
    return NextResponse.json({
      pipeline, attention, clients, leads, marketing, offers, offerState, drafts, contentState, ledger, probe, trackLinks, analyst,
    });
  } catch (error: any) {
    console.error("CRM API error:", error);
    return NextResponse.json({ error: error?.message ?? "Failed to load the business" }, { status: 500 });
  }
}
