import { NextResponse } from "next/server";
import { CognitiveLoadSample } from "@/cockpit/types";

export async function GET() {
  const now = Date.now();

  const data: CognitiveLoadSample[] = [
    {
      timestamp: new Date(now - 60000).toISOString(),
      load: 0.32,
    },
    {
      timestamp: new Date(now).toISOString(),
      load: 0.58,
    },
  ];

  return NextResponse.json(data);
}
