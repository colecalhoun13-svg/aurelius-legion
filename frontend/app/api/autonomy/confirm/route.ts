import { NextResponse } from "next/server";
import { confirmAction } from "../../../../../aurelius/autonomy/executor";
import { registerAllActions } from "../../../../../aurelius/autonomy/registerActions";

// DB + action-side-effects — never statically evaluate at build time.
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    // The registry is populated at backend boot; this Next process is separate,
    // so ensure the finalizers are registered here too (idempotent).
    registerAllActions();
    const body = await request.json();
    if (!body?.signalId || typeof body.signalId !== "string") {
      return NextResponse.json({ error: "signalId is required" }, { status: 400 });
    }
    const result = await confirmAction(body.signalId);
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error: any) {
    console.error("Confirm action error:", error);
    return NextResponse.json({ error: error?.message ?? "confirm failed" }, { status: 500 });
  }
}
