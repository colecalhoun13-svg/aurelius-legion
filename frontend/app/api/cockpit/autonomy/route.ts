import { NextResponse } from "next/server";
import { AutonomyEvent } from "@/cockpit/types";

export async function GET() {
  const events: AutonomyEvent[] = [
    {
      id: "evt-1",
      timestamp: new Date().toISOString(),
      type: "decision",
      summary: "Selected research direction: cognitive load optimization",
      details: "Evaluated 3 candidate paths and chose the highest ROI route.",
      metadata: { confidence: 0.92 }
    }
  ];

  return NextResponse.json(events);
}
