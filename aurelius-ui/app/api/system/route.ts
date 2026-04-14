import { NextResponse } from "next/server";
import { readSystemState } from "../../../lib/readers";

export async function GET() {
  return NextResponse.json(readSystemState());
}
