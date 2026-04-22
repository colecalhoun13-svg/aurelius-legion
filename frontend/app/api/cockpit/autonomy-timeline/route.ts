import { NextResponse } from "next/server";
import { AutonomyLoopStep } from "@/cockpit/types";

export async function GET() {
  const data: AutonomyLoopStep[] = [
    {
      id: "s1",
      timestamp: new Date().toISOString(),
      phase: "perception",
      description: "Gathered system + operator signals",
    },
    {
      id: "s2",
      timestamp: new Date().toISOString(),
      phase: "planning",
      description: "Generated candidate actions",
    },
    {
      id: "s3",
      timestamp: new Date().toISOString(),
      phase: "action",
      description: "Executed selected action",
    },
  ];

  return NextResponse.json(data);
}
