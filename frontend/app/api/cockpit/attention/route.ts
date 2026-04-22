import { NextResponse } from "next/server";
import { AttentionMetric } from "@/cockpit/types";

export async function GET() {
  const now = Date.now();

  const data: AttentionMetric[] = [
    {
      timestamp: new Date(now - 30000).toISOString(),
      focusArea: "research",
      weight: 0.7,
    },
    {
      timestamp: new Date(now).toISOString(),
      focusArea: "autonomy",
      weight: 0.9,
    },
  ];

  return NextResponse.json(data);
}
