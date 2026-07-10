import { NextResponse } from "next/server";
import { getDeck } from "../../../../aurelius/productivity/service";

// DB-backed — never statically evaluate at build time.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date") ?? undefined;
    return NextResponse.json(await getDeck(date));
  } catch (error: any) {
    console.error("Deck API error:", error);
    return NextResponse.json(
      { error: error?.message ?? "Failed to load deck" },
      { status: 500 }
    );
  }
}
