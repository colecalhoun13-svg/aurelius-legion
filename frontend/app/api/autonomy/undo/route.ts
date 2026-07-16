import { NextResponse } from "next/server";

// DB + inverse side-effects — never statically evaluate at build time.
export const dynamic = "force-dynamic";

// POST { signalId } — reverse an executed action (runs its registered inverse).
export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body?.signalId || typeof body.signalId !== "string") {
      return NextResponse.json({ error: "signalId is required" }, { status: 400 });
    }
    // This Next process is separate from the backend, so make sure the inverses
    // are registered here too (idempotent).
    const { registerAllActions } = await import("../../../../../aurelius/autonomy/registerActions");
    registerAllActions();
    const { undoAction } = await import("../../../../../aurelius/autonomy/executor");
    const result = await undoAction(body.signalId);
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error: any) {
    console.error("Undo action error:", error);
    return NextResponse.json({ error: error?.message ?? "undo failed" }, { status: 500 });
  }
}
