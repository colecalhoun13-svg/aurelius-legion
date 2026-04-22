import { NextResponse } from "next/server";
import { ContextWindowSnapshot } from "@/cockpit/types";

export async function GET() {
  const now = Date.now();
  const data: ContextWindowSnapshot[] = [
    {
      id: "c1",
      timestamp: new Date(now - 60000).toISOString(),
      tokensUsed: 32000,
      tokensAvailable: 128000,
    },
    {
      id: "c2",
      timestamp: new Date(now).toISOString(),
      tokensUsed: 48000,
      tokensAvailable: 128000,
    },
  ];
  return NextResponse.json(data);
}
