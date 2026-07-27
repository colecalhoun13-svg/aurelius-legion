import { NextResponse } from "next/server";
import { listEventsRange } from "../../../../aurelius/calendar/engine";
import { isCalendarConnected, isCalendarConfigured } from "../../../../aurelius/calendar/googleAuth";

// DB-backed — never statically evaluate at build time.
export const dynamic = "force-dynamic";

// POST { title, startAt, endAt } — Cole's own hand adding an event from the
// grid. Requires the Google connection; fails honestly when it isn't there.
export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.title || !body.startAt || !body.endAt) {
      return NextResponse.json({ error: "title + startAt + endAt required" }, { status: 400 });
    }
    const { createCalendarEvent } = await import("../../../../aurelius/calendar/engine");
    const event = await createCalendarEvent({
      title: String(body.title),
      startAt: new Date(body.startAt),
      endAt: new Date(body.endAt),
    });
    return NextResponse.json({ ok: true, event });
  } catch (error: any) {
    console.error("Calendar create error:", error);
    return NextResponse.json({ error: error?.message ?? "Failed to create event" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const fromDate = from ? new Date(from) : new Date();
    const toDate = to ? new Date(to) : new Date(fromDate.getTime() + 7 * 86400_000);
    const { prisma } = await import("../../../../aurelius/core/db/prisma");
    const [events, connected, tasks] = await Promise.all([
      listEventsRange(fromDate, toDate),
      isCalendarConfigured() ? isCalendarConnected() : Promise.resolve(false),
      // Scheduled tasks share the grid — the WHOLE range, not just today
      // (the deck only carries today's, which left future days blank).
      prisma.task.findMany({
        where: {
          scheduledFor: { gte: fromDate, lte: toDate },
          status: { notIn: ["done", "abandoned", "dropped"] },
        },
        orderBy: { scheduledFor: "asc" },
        select: { id: true, title: true, scheduledFor: true, status: true },
      }),
    ]);
    return NextResponse.json({ connected, configured: isCalendarConfigured(), events, tasks });
  } catch (error: any) {
    console.error("Calendar API error:", error);
    return NextResponse.json(
      { error: error?.message ?? "Failed to load calendar" },
      { status: 500 }
    );
  }
}
