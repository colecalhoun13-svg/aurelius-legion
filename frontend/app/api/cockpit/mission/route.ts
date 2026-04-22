import { NextResponse } from "next/server";
import { MissionLogEntry } from "@/cockpit/types";

export async function GET() {
  const logs: MissionLogEntry[] = [
    {
      id: "log-1",
      timestamp: new Date().toISOString(),
      level: "info",
      message: "Aurelius initialized cockpit data pipeline.",
    },
    {
      id: "log-2",
      timestamp: new Date().toISOString(),
      level: "success",
      message: "Operator and System panels synced successfully.",
    }
  ];

  return NextResponse.json(logs);
}
