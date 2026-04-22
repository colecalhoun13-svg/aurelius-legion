import { NextResponse } from "next/server";
import { ApiThroughputPoint } from "@/cockpit/types";

export async function GET() {
  const now = Date.now();
  const data: ApiThroughputPoint[] = Array.from({ length: 5 }).map((_, i) => ({
    timestamp: new Date(now - i * 60000).toISOString(),
    requestsPerMinute: 20 + i * 5,
  }));
  return NextResponse.json(data);
}
