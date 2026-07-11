import { NextResponse } from "next/server";
import { recordCorrection, listCorrections } from "../../../../aurelius/knowledge/corrections";

// DB-backed — never statically evaluate at build time.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ corrections: await listCorrections() });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Failed to load corrections" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { targetType, targetId, correctionType, reason, after, operatorName } = body ?? {};
    if (!targetType || !targetId || !reason) {
      return NextResponse.json({ error: "targetType, targetId, and reason are required" }, { status: 400 });
    }
    const result = await recordCorrection({ targetType, targetId, correctionType, reason, after, operatorName });
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Corrections API error:", error);
    return NextResponse.json({ error: error?.message ?? "Failed to record correction" }, { status: 500 });
  }
}
