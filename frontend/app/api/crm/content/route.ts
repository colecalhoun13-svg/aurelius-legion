import { NextResponse } from "next/server";
import { saveDraft, listDrafts, updateDraft, discardDraft, stageForPublish, queueState } from "../../../../../aurelius/content/queue";

export const dynamic = "force-dynamic";

/** The queue, and whether any of it has actually gone out. */
export async function GET() {
  try {
    const [drafts, state] = await Promise.all([listDrafts({}), queueState()]);
    return NextResponse.json({ drafts, state });
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
      default:
        throw new Error(`Unknown kind: ${body?.kind}. Expected keep, edit, discard, or publish.`);
    }
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Content action failed" }, { status: 400 });
  }
}
