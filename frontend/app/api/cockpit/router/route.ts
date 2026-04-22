import { NextResponse } from "next/server";
import { RouterRouteEvent } from "@/cockpit/types";

export async function GET() {
  const data: RouterRouteEvent[] = [
    {
      id: "r1",
      timestamp: new Date().toISOString(),
      engine: "research-engine",
      route: "/research/query",
      latencyMs: 123,
    },
  ];
  return NextResponse.json(data);
}
