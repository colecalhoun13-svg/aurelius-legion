import { NextResponse } from "next/server";
import { registerAllTools } from "../../../../aurelius/tools/registerTools";
import { listTools } from "../../../../aurelius/tools/toolRegistry";
import { getIntegrations } from "../../../../aurelius/tools/integrationStatus";

export const dynamic = "force-dynamic";

let registered = false;

export async function GET() {
  try {
    if (!registered) {
      registerAllTools();
      registered = true;
    }
    const [integrations] = await Promise.all([getIntegrations()]);
    return NextResponse.json({
      registered: listTools().map((t: any) => ({
        name: t.name,
        actions: t.actions.map((a: any) => a.name ?? a),
      })),
      integrations,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "failed" }, { status: 500 });
  }
}
