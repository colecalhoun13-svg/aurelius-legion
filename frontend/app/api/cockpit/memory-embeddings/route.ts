import { NextResponse } from "next/server";
import { MemoryEmbeddingPoint } from "@/cockpit/types";

export async function GET() {
  const data: MemoryEmbeddingPoint[] = [
    { id: "e1", x: 0.12, y: 0.88, label: "identity" },
    { id: "e2", x: 0.45, y: 0.33, label: "operator" },
    { id: "e3", x: 0.78, y: 0.55, label: "task" },
  ];

  return NextResponse.json(data);
}
