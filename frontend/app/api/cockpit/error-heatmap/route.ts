import { NextResponse } from "next/server";
import { ErrorHeatmapCell } from "@/cockpit/types";

export async function GET() {
  const data: ErrorHeatmapCell[] = [
    { area: "router", count: 2 },
    { area: "memory", count: 0 },
    { area: "research", count: 1 },
  ];
  return NextResponse.json(data);
}
