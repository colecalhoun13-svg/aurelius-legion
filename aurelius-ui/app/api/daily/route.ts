import { NextResponse } from "next/server";
import { readDailyLogs } from "../../../lib/readers";

export async function GET() {
  return NextResponse.json(readDailyLogs());
}
