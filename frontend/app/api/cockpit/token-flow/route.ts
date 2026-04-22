import { NextResponse } from "next/server";
import { TokenFlowPoint } from "@/cockpit/types";

export async function GET() {
  const now = Date.now();

  const data: TokenFlowPoint[] = [
    {
      timestamp: new Date(now - 60000).toISOString(),
      tokensIn: 1200,
      tokensOut: 800,
    },
    {
      timestamp: new Date(now - 30000).toISOString(),
      tokensIn: 1500,
      tokensOut: 1100,
    },
    {
      timestamp: new Date(now).toISOString(),
      tokensIn: 1800,
      tokensOut: 1400,
    },
  ];

  return NextResponse.json(data);
}
