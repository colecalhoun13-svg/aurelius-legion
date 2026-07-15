import { NextResponse } from "next/server";
import { listTraceThreads, getTraceThread } from "../../../../aurelius/observability/traceThreads";

// DB-backed telemetry — always live.
export const dynamic = "force-dynamic";

// GET /api/traces           → recent threads (each with its steps)
// GET /api/traces?id=<tid>  → a single thread
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (id) {
      const thread = await getTraceThread(id);
      if (!thread) return NextResponse.json({ error: "thread not found" }, { status: 404 });
      return NextResponse.json({ thread });
    }
    const limit = Math.min(Number(searchParams.get("limit") ?? 25) || 25, 100);
    return NextResponse.json({ threads: await listTraceThreads(limit) });
  } catch (error: any) {
    console.error("Traces API error:", error);
    return NextResponse.json({ error: error?.message ?? "Failed to load traces" }, { status: 500 });
  }
}
