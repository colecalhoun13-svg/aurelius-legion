import { NextResponse } from "next/server";
import { SystemStatus } from "@/cockpit/types";

export async function GET() {
  const status: SystemStatus = {
    cpuLoad: 0.37,
    memoryUsage: 0.54,
    activeTasks: 3,
    queueDepth: 1,
    uptime: 48291,
    updatedAt: new Date().toISOString(),
  };

  return NextResponse.json(status);
}
