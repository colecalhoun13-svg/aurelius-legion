import { NextResponse } from "next/server";
import { readMemory } from "../../../lib/readers";

export async function GET() {
  return NextResponse.json(readMemory());
}
