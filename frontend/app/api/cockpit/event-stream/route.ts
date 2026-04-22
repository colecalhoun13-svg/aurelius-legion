import { NextResponse } from "next/server";
import { EventStreamEntry } from "@/cockpit/types";

export async function GET() {
  const data: EventStreamEntry[] = [
    {
      id: "ev1",
      timestamp: new Date().toISOString(),
      channel: "system",
      message: "System heartbeat OK",
    },
    {
      id: "ev2",
      timestamp: new Date().toISOString(),
      channel: "autonomy",
      message: "Loop iteration completed",
    },
  ];

  return NextResponse.json(data);
}
