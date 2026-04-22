import { NextResponse } from "next/server";
import { ModelLatencyPoint } from "@/cockpit/types";

export async function GET() {
  const data: ModelLatencyPoint[] = [
    { model: "gpt-4.1", avgLatencyMs: 320 },
    { model: "sonnet-3.5", avgLatencyMs: 280 },
  ];
  return NextResponse.json(data);
}
