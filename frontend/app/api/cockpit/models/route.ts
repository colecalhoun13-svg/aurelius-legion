import { NextResponse } from "next/server";
import { ModelRegistryEntry } from "@/cockpit/types";

export async function GET() {
  const data: ModelRegistryEntry[] = [
    {
      id: "m1",
      name: "gpt-4.1",
      provider: "openai",
      contextWindow: 128000,
      status: "active",
    },
    {
      id: "m2",
      name: "sonnet-3.5",
      provider: "anthropic",
      contextWindow: 200000,
      status: "standby",
    },
  ];
  return NextResponse.json(data);
}
