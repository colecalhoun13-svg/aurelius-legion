import { NextResponse } from "next/server";
import { listTasks } from "../../../../aurelius/productivity/service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await listTasks({ status: "inbox" }));
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "failed" }, { status: 500 });
  }
}
