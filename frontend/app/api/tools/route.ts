import { NextResponse } from "next/server";
import { registerAllTools } from "../../../../aurelius/tools/registerTools";
import { listTools } from "../../../../aurelius/tools/toolRegistry";

export const dynamic = "force-dynamic";

let registered = false;

export async function GET() {
  try {
    if (!registered) {
      registerAllTools();
      registered = true;
    }
    return NextResponse.json(listTools().map((t: any) => ({ name: t.name, actions: t.actions.map((a: any) => a.name ?? a) })));
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "failed" }, { status: 500 });
  }
}
