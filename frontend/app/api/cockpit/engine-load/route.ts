import { NextResponse } from "next/server";
import { EngineLoadPoint } from "@/cockpit/types";

export async function GET() {
  const data: EngineLoadPoint[] = [
    { engine: "orchestrator", load: 0.4 },
    { engine: "research-engine", load: 0.7 },
  ];
  return NextResponse.json(data);
}
