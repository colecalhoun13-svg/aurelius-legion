import { NextResponse } from "next/server";
import { MemoryTimelinePoint } from "@/cockpit/types";

export async function GET() {
  const data: MemoryTimelinePoint[] = [
    {
      id: "mt1",
      timestamp: new Date().toISOString(),
      event: "Updated operator preferences",
      category: "identity",
    },
  ];
  return NextResponse.json(data);
}
