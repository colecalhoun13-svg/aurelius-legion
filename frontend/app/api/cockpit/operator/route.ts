import { NextResponse } from "next/server";
import { OperatorStatus } from "@/cockpit/types";

export async function GET() {
  const status: OperatorStatus = {
    id: "op-1",
    mode: "thinking",
    uptime: 48291,
    load: 0.42,
    lastAction: "Processed autonomy loop decision",
    updatedAt: new Date().toISOString(),
  };

  return NextResponse.json(status);
}
