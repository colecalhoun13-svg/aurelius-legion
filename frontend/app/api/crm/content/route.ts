import { NextResponse } from "next/server";
import {
  saveDraft,
  listDrafts,
  updateDraft,
  discardDraft,
  stageForPublish,
  queueState,
  planSlots,
  cadenceTruth,
} from "../../../../../aurelius/content/queue";

export const dynamic = "force-dynamic";

/** The queue, whether any of it has actually gone out, and the cadence truth. */
export async function GET() {
  try {
    const [drafts, state, cadence] = await Promise.all([listDrafts({}), queueState(), cadenceTruth()]);
    return NextResponse.json({ drafts, state, cadence });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Failed to load the queue" }, { status: 500 });
  }
}

/**
 * Keeping and editing are INWARD. `publish` is outward and only ever stages a
 * proposal on the Bridge — this endpoint cannot post, by construction.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    switch (body?.kind) {
      case "keep": {
        const out = await saveDraft(body);
        if (!out.ok) throw new Error(out.error ?? "Could not keep that");
        return NextResponse.json(out);
      }
      case "edit": {
        if (!body.draftId) throw new Error("Which draft?");
        const out = await updateDraft(String(body.draftId), body);
        if (!out.ok) throw new Error(out.error ?? "Could not update");
        return NextResponse.json(out);
      }
      case "discard": {
        if (!body.draftId) throw new Error("Which draft?");
        const out = await discardDraft(String(body.draftId));
        if (!out.ok) throw new Error(out.error ?? "Could not discard");
        return NextResponse.json(out);
      }
      case "publish": {
        if (!body.draftId) throw new Error("Which draft?");
        const out = await stageForPublish(String(body.draftId));
        if (!out.ok) throw new Error(out.error ?? "Could not stage");
        return NextResponse.json(out);
      }
      // INWARD: assigns Mon/Thu 9am scheduledFor dates to ready drafts that
      // lack one. A slot is a plan on a draft — publishing still stages on
      // the Bridge for Cole's confirm, always.
      case "plan_slots": {
        const out = await planSlots(body.perWeek != null ? Number(body.perWeek) : undefined);
        return NextResponse.json(out);
      }
      default:
        throw new Error(`Unknown kind: ${body?.kind}. Expected keep, edit, discard, publish, or plan_slots.`);
    }
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Content action failed" }, { status: 400 });
  }
}
