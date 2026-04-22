import { NextResponse } from "next/server";
import { KnowledgeGraphNode } from "@/cockpit/types";

export async function GET() {
  const data: KnowledgeGraphNode[] = [
    { id: "n1", label: "Cole", type: "operator" },
    { id: "n2", label: "Aurelius", type: "system" },
    { id: "n3", label: "Cockpit", type: "module" },
  ];
  return NextResponse.json(data);
}
