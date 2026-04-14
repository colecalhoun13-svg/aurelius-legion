import { NextResponse } from "next/server";
import { readWeeklyLogs } from "../../../lib/readers";

export async function GET() {
  return NextResponse.json(readWeeklyLogs());
}
