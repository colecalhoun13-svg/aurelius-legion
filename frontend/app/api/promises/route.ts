import { NextResponse } from "next/server";

// THE PROMISE LEDGER + QUIET MODE endpoint (completeness wave).
//
// GET  → { promises: [...], quiet: { active, until?, reason? } }
//        Runs lapseSweep first (open past-due → lapsed) and ensureQuietState
//        (an expired quiet window restores itself on this read — the lazy
//        "on boot + daily" check rides every Home load).
//
// POST ops (body: { op, ... }):
//   { op: "resolve", id, status: "kept"|"dropped" }   — rule on a promise
//   { op: "add", counterpart, text, direction?, due? } — file one by hand
//   { op: "quiet", days?, hours?, reason? }            — enter quiet mode
//       (pauses briefing/midday/debrief/outreach-sweep, shifts open-lead
//        follow-ups past the window; auto-restores when it ends). The live
//        cron registry lives in the backend process — from here the pause is
//        persisted + self-healed by the backend's next ritual tick, and the
//        ritual generators themselves honor the quiet flag regardless.
//   { op: "quiet_end" }                                — end quiet now.
//
// The settings page's quiet form and the Home "Ledger of promises" section
// are the callers.

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { lapseSweep, listOpenPromises } = await import("../../../../aurelius/productivity/promises.ts");
    const { ensureQuietState } = await import("../../../../aurelius/planning/quiet.ts");
    await lapseSweep();
    const [promises, quiet] = await Promise.all([listOpenPromises(), ensureQuietState()]);
    return NextResponse.json({
      promises: promises.map((p) => ({
        id: p.id,
        direction: p.direction,
        counterpart: p.counterpart,
        text: p.text,
        dueAt: p.dueAt,
        status: p.status,
      })),
      quiet: { active: quiet.active, until: quiet.until ?? null, reason: quiet.reason ?? null },
    });
  } catch (error: any) {
    console.error("Promises GET error:", error);
    return NextResponse.json({ error: error?.message ?? "Failed to load the ledger" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  try {
    switch (body?.op) {
      case "resolve": {
        if (!body.id || !["kept", "dropped"].includes(body.status)) {
          return NextResponse.json({ error: "resolve needs id + status kept|dropped" }, { status: 400 });
        }
        const { resolvePromise } = await import("../../../../aurelius/productivity/promises.ts");
        const p = await resolvePromise(String(body.id), body.status);
        if (!p) return NextResponse.json({ error: "already resolved" }, { status: 409 });
        return NextResponse.json({ ok: true, promise: { id: p.id, status: p.status } });
      }
      case "add": {
        const { addPromise } = await import("../../../../aurelius/productivity/promises.ts");
        const p = await addPromise({
          direction: body.direction === "waiting_on" ? "waiting_on" : "owed_by_cole",
          counterpart: String(body.counterpart ?? ""),
          text: String(body.text ?? ""),
          dueAt: body.due ?? undefined,
          sourceType: "cole",
        });
        return NextResponse.json({ ok: true, id: p.id });
      }
      case "quiet": {
        const days = Number(body.days ?? 0) || 0;
        const hours = Number(body.hours ?? 0) || 0;
        const ms = days * 86400_000 + hours * 3600_000;
        if (ms <= 0) return NextResponse.json({ error: "quiet needs days and/or hours > 0" }, { status: 400 });
        const { quietUntil } = await import("../../../../aurelius/planning/quiet.ts");
        const r = await quietUntil(new Date(Date.now() + ms).toISOString(), String(body.reason ?? "away"));
        if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
        return NextResponse.json({ ok: true, until: r.until, leadsShifted: r.leadsShifted });
      }
      case "quiet_end": {
        const { endQuietNow } = await import("../../../../aurelius/planning/quiet.ts");
        const state = await endQuietNow();
        return NextResponse.json({ ok: true, restored: !!state.restored, summary: state.summary ?? null });
      }
      default:
        return NextResponse.json({ error: `unknown op: ${body?.op}` }, { status: 400 });
    }
  } catch (error: any) {
    console.error("Promises POST error:", error);
    return NextResponse.json({ error: error?.message ?? "Action failed" }, { status: 500 });
  }
}
