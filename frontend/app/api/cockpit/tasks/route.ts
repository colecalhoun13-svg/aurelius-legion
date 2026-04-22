import { NextResponse } from "next/server";
import { TaskEngineStatus } from "@/cockpit/types";

export async function GET() {
  const data: TaskEngineStatus[] = [
    {
      id: "t1",
      name: "orchestrator",
      activeTasks: 2,
      queuedTasks: 1,
      lastRun: new Date().toISOString(),
    },
    {
      id: "t2",
      name: "research-runner",
      activeTasks: 1,
      queuedTasks: 0,
      lastRun: new Date().toISOString(),
    },
  ];
  return NextResponse.json(data);
}
