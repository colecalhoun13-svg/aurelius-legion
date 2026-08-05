import { NextResponse } from "next/server";
import {
  pipelineSnapshot,
  whatNeedsAttention,
  listClients,
  listLeads,
} from "../../../../aurelius/crm/service";

// DB-backed — never statically evaluate at build time.
export const dynamic = "force-dynamic";

/** Everything the Business page needs, in one round trip. */
export async function GET() {
  try {
    const [pipeline, attention, clients, leads] = await Promise.all([
      pipelineSnapshot(),
      whatNeedsAttention(14),
      listClients({}),
      listLeads({ limit: 200 }),
    ]);
    return NextResponse.json({ pipeline, attention, clients, leads });
  } catch (error: any) {
    console.error("CRM API error:", error);
    return NextResponse.json({ error: error?.message ?? "Failed to load the business" }, { status: 500 });
  }
}
