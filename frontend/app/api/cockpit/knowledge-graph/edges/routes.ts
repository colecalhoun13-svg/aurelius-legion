import { NextResponse } from "next/server";
import { KnowledgeGraphEdge } from "@/cockpit/types";

export async function GET() {
  const data: KnowledgeGraphEdge[] = [
    { id: "e1", from: "n1", to: "n2", label: "operates" },
    { id: "e2", from: "n2", to: "n3", label: "owns" },
  ];
  return NextResponse.json(data);
}
