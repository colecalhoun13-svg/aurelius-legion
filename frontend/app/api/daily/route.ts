import { NextResponse } from "next/server";

// IMPORTANT: this path is correct based on your repo structure.
// If dailySnapshot.ts exports a different function name, paste it and I’ll adjust.
import { getDailySnapshot } from "../../../../aurelius/autonomy/dailySnapshot";

export async function GET() {
  try {
    // Run the real OS snapshot
    const snapshot = await getDailySnapshot();

    return NextResponse.json({
      success: true,
      snapshot,
    });
  } catch (error: any) {
    console.error("Daily Snapshot API Error:", error);

    return NextResponse.json(
      {
        success: false,
        error: error?.message ?? "Failed to generate daily snapshot",
      },
      { status: 500 }
    );
  }
}
