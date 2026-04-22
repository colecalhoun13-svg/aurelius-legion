import { NextResponse } from "next/server";
import { ResearchInsight } from "@/cockpit/types";

export async function GET() {
  const insights: ResearchInsight[] = [
    {
      id: "ins-1",
      timestamp: new Date().toISOString(),
      topic: "Training Efficiency",
      insight: "Athletes improve 17% faster with micro‑block periodization.",
      confidence: 0.88,
      source: "internal-model"
    }
  ];

  return NextResponse.json(insights);
}
