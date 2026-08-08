import { NextResponse } from "next/server";
import { listSchedules, setSchedule, setEnabled } from "../../../../../aurelius/core/schedule";

// THE RITUALS DIAL — honest about which process holds it.
//
// The node-schedule registry is PER-PROCESS and the jobs are scheduled in the
// backend Express process (aurelius/index.ts). This route imports the same
// module, but in the Next.js process the registry is EMPTY — and no backend
// HTTP endpoint exposes schedule control (ritualsRouter only serves briefing/
// debrief content). So GET reports { live: false } when the registry is bare,
// the Tuning page keeps its static list with the "re-time from chat" kicker,
// and POST refuses loudly instead of mutating a registry no scheduler reads.
// If the processes ever merge (or a backend schedule endpoint lands and this
// becomes a proxy), the same page lights up with the real dials — no fake
// buttons in the meantime.

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rituals = listSchedules();
    if (rituals.length === 0) {
      // Empty registry = this process doesn't run the scheduler. Say so.
      return NextResponse.json({ live: false, rituals: [] });
    }
    return NextResponse.json({ live: true, rituals });
  } catch (error: any) {
    console.error("Rituals list error:", error);
    return NextResponse.json({ error: error?.message ?? "Failed to list rituals" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { op, name, time } = body ?? {};
    if (!["retime", "pause", "resume"].includes(op) || !name || typeof name !== "string") {
      return NextResponse.json({ error: "op (retime|pause|resume) + name required" }, { status: 400 });
    }
    if (listSchedules().length === 0) {
      // Honest failure, not a silent no-op: a write here would change nothing
      // the scheduler reads. The chat tool (planning.set_schedule) rides the
      // backend process and is the working dial.
      return NextResponse.json(
        { error: "The schedule registry lives in the backend process — this surface can't reach it. Re-time from chat: “move my brief to 6:30”." },
        { status: 409 }
      );
    }
    if (op === "retime") {
      if (!time || typeof time !== "string") {
        return NextResponse.json({ error: "time required for retime, e.g. “6:30” or “7am”" }, { status: 400 });
      }
      const r = await setSchedule(name, time);
      if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
      return NextResponse.json({ ok: true, name: r.name, label: r.label, time: r.time, cadence: r.cadence });
    }
    const r = await setEnabled(name, op === "resume");
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
    return NextResponse.json({ ok: true, name: r.name, label: r.label, enabled: r.enabled });
  } catch (error: any) {
    console.error("Rituals control error:", error);
    return NextResponse.json({ error: error?.message ?? "Ritual control failed" }, { status: 500 });
  }
}
