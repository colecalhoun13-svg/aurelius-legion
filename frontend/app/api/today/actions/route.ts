import { NextResponse } from "next/server";
import {
  createTask,
  completeTask,
  quickCapture,
  completeHabit,
  createHabit,
  upsertTodayPlan,
} from "../../../../../aurelius/productivity/service";

// DB-backed — never statically evaluate at build time.
export const dynamic = "force-dynamic";

// Single action endpoint for the Today view. Body: { action, ...payload }.
export async function POST(request: Request) {
  try {
    const body = await request.json();
    switch (body.action) {
      case "createTask":
        return NextResponse.json(
          await createTask({
            title: body.title,
            status: body.status ?? "today",
            priority: body.priority,
            domain: body.domain,
          })
        );
      case "completeTask":
        return NextResponse.json(await completeTask(body.id));
      case "capture":
        return NextResponse.json(await quickCapture({ content: body.content }));
      case "createHabit":
        return NextResponse.json(await createHabit({ name: body.name }));
      case "completeHabit":
        return NextResponse.json(await completeHabit(body.id, body.date));
      case "setPlan":
        return NextResponse.json(
          await upsertTodayPlan({ date: body.date, focus: body.focus })
        );
      default:
        return NextResponse.json({ error: `unknown action: ${body.action}` }, { status: 400 });
    }
  } catch (error: any) {
    console.error("Today action error:", error);
    return NextResponse.json(
      { error: error?.message ?? "Action failed" },
      { status: 500 }
    );
  }
}
