import { NextResponse } from "next/server";
import { MemoryView } from "@/cockpit/types";

export async function GET() {
  const memory: MemoryView[] = [
    {
      id: "mem-1",
      category: "identity",
      value: "Aurelius prioritizes clarity, speed, and operator‑grade execution.",
      lastUpdated: new Date().toISOString()
    }
  ];

  return NextResponse.json(memory);
}
