import { NextResponse } from "next/server";
import { getToday } from "../../../../aurelius/productivity/service";

// DB-backed — never statically evaluate at build time.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date") ?? undefined;
    const today = await getToday(date);
    return NextResponse.json(today);
  } catch (error: any) {
    console.error("Today API error:", error);
    return NextResponse.json(
      { error: error?.message ?? "Failed to load today" },
      { status: 500 }
    );
  }
}
