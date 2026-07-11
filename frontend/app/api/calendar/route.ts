import { NextResponse } from "next/server";
import { listEventsRange } from "../../../../aurelius/calendar/engine";
import { isCalendarConnected, isCalendarConfigured } from "../../../../aurelius/calendar/googleAuth";

// DB-backed — never statically evaluate at build time.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const fromDate = from ? new Date(from) : new Date();
    const toDate = to ? new Date(to) : new Date(fromDate.getTime() + 7 * 86400_000);
    const [events, connected] = await Promise.all([
      listEventsRange(fromDate, toDate),
      isCalendarConfigured() ? isCalendarConnected() : Promise.resolve(false),
    ]);
    return NextResponse.json({ connected, configured: isCalendarConfigured(), events });
  } catch (error: any) {
    console.error("Calendar API error:", error);
    return NextResponse.json(
      { error: error?.message ?? "Failed to load calendar" },
      { status: 500 }
    );
  }
}
