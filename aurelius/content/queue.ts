// aurelius/content/queue.ts
//
// THE CONTENT QUEUE — where writing survives the tab closing.
//
// The funnel used to run angle → asset → /dev/null. `draftAsset` returned a
// string into a panel; `draft_post` returned a caption into a chat message;
// `content.draft` was declared as an action class with nothing executing it.
// Cole could generate copy all day and keep none of it, which meant the
// "content side" he asked for was a text generator, not a pipeline.
//
// Rules:
//
//   1. EVERY DRAFT IS EDITABLE, AND EDITING IS THE POINT. Aurelius writes the
//      first version; what actually gets published should be Cole's. `updateDraft`
//      exists so his edit is the artifact, not a correction filed elsewhere.
//   2. GROUNDING SURVIVES THE HANDOFF. A post written off a researched angle and
//      one improvised from a topic are not the same claim, and the queue keeps
//      the difference — otherwise the marketing engine's whole honesty contract
//      dies at the panel edge.
//   3. PUBLISHING STAYS OUTWARD. `stageForPublish` goes through
//      executeAction("content.publish"), which gates by construction: a pending
//      Bridge proposal Cole taps. Nothing in this file can post.
//   4. NOTHING IS FILED THAT SHOULDN'T EXIST. An engine-error string is never
//      saved as a draft (hard rule 3) — the guard is here, not just at the call
//      sites, because a queue is exactly where such text would quietly persist.

import { prisma } from "../core/db/prisma.ts";
import { engineUnavailableText } from "../llm/nonAnswer.ts";
import { executeAction } from "../autonomy/executor.ts";

export const DRAFT_STATUSES = ["draft", "ready", "staged", "published", "discarded"] as const;
export type DraftStatus = (typeof DRAFT_STATUSES)[number];

/** The inward action class this file finally gives an invoker to. */
export const CONTENT_DRAFT_CLASS = "content.draft";

export type SaveDraftInput = {
  body: string;
  channel?: string;
  format?: string;
  title?: string;
  angleId?: string;
  grounding?: string;
  imageUrl?: string;
};

/**
 * Keep a piece of writing. Returns `ok: false` rather than throwing so a caller
 * on a UI path can show the reason instead of a stack trace.
 */
export async function saveDraft(input: SaveDraftInput): Promise<{ ok: boolean; id?: string; error?: string }> {
  const body = (input.body ?? "").trim();
  if (body.length < 10) return { ok: false, error: "Nothing to keep — the draft is empty." };
  // Rule 4. Without this the queue becomes the one place a "…engine is not
  // configured" string can sit until it's staged for publish.
  if (engineUnavailableText(body)) {
    return { ok: false, error: "That's an engine error, not a draft. Nothing was filed." };
  }

  // If it came from an angle, inherit that angle's grounding rather than
  // trusting the caller — the provenance belongs to the evidence, not the UI.
  let grounding = input.grounding ?? "none";
  if (input.angleId) {
    const angle = await prisma.marketingAngle.findUnique({ where: { id: input.angleId } });
    if (angle) grounding = angle.grounding;
  }

  const row = await prisma.contentDraft.create({
    data: {
      body,
      channel: input.channel ?? "instagram",
      format: input.format ?? null,
      title: input.title?.trim() || null,
      angleId: input.angleId ?? null,
      grounding,
      imageUrl: input.imageUrl?.trim() || null,
    },
  });
  return { ok: true, id: row.id };
}

export async function listDrafts(opts: { status?: string; limit?: number } = {}) {
  return prisma.contentDraft.findMany({
    where: opts.status ? { status: opts.status } : { status: { notIn: ["discarded"] } },
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    take: Math.min(opts.limit ?? 50, 200),
    include: { angle: { select: { title: true } } },
  });
}

/**
 * Cole's edit. The published version should be his words, so this is a
 * first-class operation rather than a hidden admin path.
 */
export async function updateDraft(
  id: string,
  patch: { body?: string; title?: string; imageUrl?: string; status?: string; scheduledFor?: string | Date | null }
): Promise<{ ok: boolean; error?: string }> {
  const existing = await prisma.contentDraft.findUnique({ where: { id } });
  if (!existing) return { ok: false, error: `No draft with id ${id}.` };
  if (existing.status === "published") {
    return { ok: false, error: "That one's already out. Editing it here wouldn't change what people saw." };
  }

  const data: Record<string, any> = {};
  if (patch.body !== undefined) {
    const body = String(patch.body).trim();
    if (body.length < 10) return { ok: false, error: "A draft can't be emptied — discard it instead." };
    data.body = body;
  }
  if (patch.title !== undefined) data.title = String(patch.title).trim() || null;
  if (patch.imageUrl !== undefined) data.imageUrl = String(patch.imageUrl).trim() || null;
  if (patch.status !== undefined) {
    if (!(DRAFT_STATUSES as readonly string[]).includes(patch.status)) {
      return { ok: false, error: `status must be one of: ${DRAFT_STATUSES.join(", ")}` };
    }
    // "staged" and "published" are set by the publish path, never by hand —
    // marking something published without publishing it would be a lie the
    // scoreboard then reports as output.
    if (patch.status === "staged" || patch.status === "published") {
      return { ok: false, error: "That status is set by publishing, not by editing." };
    }
    data.status = patch.status;
  }
  if (patch.scheduledFor !== undefined) {
    data.scheduledFor = patch.scheduledFor ? new Date(patch.scheduledFor) : null;
  }
  await prisma.contentDraft.update({ where: { id }, data });
  return { ok: true };
}

/**
 * Stage a draft to publish — OUTWARD, so it can only ever ask.
 *
 * executeAction gates `content.publish` by construction: this returns with a
 * pending Bridge proposal and the draft marked "staged". Cole's tap runs the
 * actual Instagram publish (autonomy/workflows/contentPublish.ts).
 */
export async function stageForPublish(id: string): Promise<{
  ok: boolean; bridgeSignalId?: string; error?: string;
}> {
  const draft = await prisma.contentDraft.findUnique({ where: { id } });
  if (!draft) return { ok: false, error: `No draft with id ${id}.` };
  if (draft.status === "published") return { ok: false, error: "Already published." };
  if (draft.status === "staged") {
    return { ok: false, error: "Already waiting on your confirm — check the Bridge." };
  }
  // Meta fetches the image itself, so a caption with no public URL cannot post.
  // Better to refuse here than to file a proposal that is guaranteed to fail.
  if (draft.channel === "instagram" && !draft.imageUrl) {
    return {
      ok: false,
      error: "Instagram needs a public image URL — Meta fetches the image itself and can't take an upload. Add one to the draft first.",
    };
  }

  const { instagramConfigured } = await import("../outward/instagram.ts");
  const configured = draft.channel !== "instagram" || instagramConfigured();

  const exec = await executeAction({
    actionClass: "content.publish",
    sourceType: "content_publish_request",
    sourceId: `draft:${draft.id}`,
    prepare: async () => ({
      title: `Publish to ${draft.channel}?`,
      body:
        `**Caption:**\n${draft.body}\n\n${draft.imageUrl ? `Image: ${draft.imageUrl}\n\n` : ""}` +
        (draft.grounding === "none"
          ? "This came from an unverified angle — the idea underneath it is a guess, not a finding.\n\n"
          : "") +
        (configured
          ? `Confirm to publish. Nothing goes out until you tap.`
          : `⚠️ ${draft.channel} isn't connected yet — confirming will fail honestly until you set it up (docs/SETUP.md). Nothing goes out.`),
      domain: "content",
      payload: { channel: draft.channel, caption: draft.body, imageUrl: draft.imageUrl ?? "", draftId: draft.id },
    }),
  });

  await prisma.contentDraft.update({
    where: { id },
    data: { status: "staged", bridgeSignalId: exec.bridgeSignalId ?? null },
  });
  return { ok: true, bridgeSignalId: exec.bridgeSignalId };
}

/**
 * Called by the publish finalizer once the post actually went out. Separate
 * from `stageForPublish` on purpose: staged and published are different facts,
 * and conflating them is how a system starts reporting work it didn't do.
 */
export async function markPublished(draftId: string, permalink?: string) {
  await prisma.contentDraft
    .update({
      where: { id: draftId },
      data: { status: "published", publishedAt: new Date(), permalink: permalink ?? null },
    })
    .catch(() => {});
}

export async function discardDraft(id: string): Promise<{ ok: boolean; error?: string }> {
  const existing = await prisma.contentDraft.findUnique({ where: { id } });
  if (!existing) return { ok: false, error: `No draft with id ${id}.` };
  await prisma.contentDraft.update({ where: { id }, data: { status: "discarded" } });
  return { ok: true };
}

// ── cadence: the schedule that survives the tab closing ──────────────
//
// scheduledFor existed on the model with nothing that ever set it in bulk —
// so "posting twice a week" lived in Cole's head, which is where cadences go
// to die. planSlots turns intent into dates; cadenceTruth is the sentence
// that refuses to let a silent feed pass unremarked. Both INWARD: a slot is
// a plan on a draft, and publishing still stops for Cole's confirm.

/** The posting days a 2/week cadence means: Monday and Thursday, 9am local. */
const SLOT_DAYS_TWO_PER_WEEK = [1, 4]; // getDay(): Mon=1, Thu=4

/**
 * Assign scheduledFor dates to READY drafts that lack one — next open Mon/Thu
 * 9am slots (server-local time; the Mini lives in Cole's timezone). "Open"
 * means no other live draft already holds that day. Drafts still in "draft"
 * status are deliberately skipped: planning schedules readiness, it can't
 * create it — slotting an unreviewed draft would schedule words Cole hasn't
 * approved as his.
 */
export async function planSlots(perWeek = 2): Promise<{
  ok: boolean; assigned: number; slots: string[]; note: string;
}> {
  const pw = Math.max(1, Math.min(Math.floor(Number(perWeek) || 2), 2));
  const days = pw === 1 ? [SLOT_DAYS_TWO_PER_WEEK[0]!] : SLOT_DAYS_TWO_PER_WEEK;

  const unslotted = await prisma.contentDraft.findMany({
    where: { status: "ready", scheduledFor: null },
    orderBy: { updatedAt: "asc" },
  });
  if (unslotted.length === 0) {
    const readyCount = await prisma.contentDraft.count({ where: { status: "ready" } });
    return {
      ok: true,
      assigned: 0,
      slots: [],
      note:
        readyCount > 0
          ? "Every ready draft already has a slot. Nothing to plan."
          : "No ready drafts to slot — mark a draft ready first. Planning schedules readiness; it can't create it.",
    };
  }

  // Days already claimed by any live scheduled draft — one post per slot day.
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const taken = await prisma.contentDraft.findMany({
    where: { status: { in: ["draft", "ready", "staged"] }, scheduledFor: { gte: today } },
    select: { scheduledFor: true },
  });
  const dayKey = (d: Date) => d.toISOString().slice(0, 10);
  const takenDays = new Set(taken.map((t) => dayKey(t.scheduledFor!)));

  // Walk forward from now, collecting the next open Mon/Thu 9am slots.
  const slots: Date[] = [];
  const cursor = new Date();
  cursor.setHours(9, 0, 0, 0);
  let guard = 0;
  while (slots.length < unslotted.length && guard < 366) {
    if (days.includes(cursor.getDay()) && cursor.getTime() > Date.now() && !takenDays.has(dayKey(cursor))) {
      slots.push(new Date(cursor));
      takenDays.add(dayKey(cursor));
    }
    cursor.setDate(cursor.getDate() + 1);
    guard++;
  }

  let assigned = 0;
  for (let i = 0; i < unslotted.length && i < slots.length; i++) {
    await prisma.contentDraft.update({
      where: { id: unslotted[i]!.id },
      data: { scheduledFor: slots[i]! },
    });
    assigned++;
  }

  const iso = slots.slice(0, assigned).map((s) => s.toISOString());
  const first = slots[0];
  return {
    ok: true,
    assigned,
    slots: iso,
    note:
      `${assigned} draft${assigned === 1 ? "" : "s"} slotted (Mon/Thu 9am` +
      `${first ? `, next ${first.toISOString().slice(0, 10)}` : ""}). ` +
      `A slot is a plan, not a post — publishing still stops for your confirm.`,
  };
}

/**
 * The honest cadence sentence, for the briefing and the Business page.
 * `line` is empty when there's nothing worth saying (published within a week,
 * or nothing written at all — queueState already tells that story); it speaks
 * only when the feed has gone quiet, because "nothing published in N days"
 * is the fact an encouraging dashboard would omit.
 */
export async function cadenceTruth(): Promise<{
  lastPublishedAt: Date | null;
  daysSince: number | null;
  plannedThisWeek: number;
  line: string;
}> {
  const last = await prisma.contentDraft.findFirst({
    where: { status: "published", publishedAt: { not: null } },
    orderBy: { publishedAt: "desc" },
    select: { publishedAt: true },
  });
  const lastPublishedAt = last?.publishedAt ?? null;
  const daysSince = lastPublishedAt
    ? Math.floor((Date.now() - lastPublishedAt.getTime()) / 86_400_000)
    : null;

  // This calendar week, Monday 00:00 local through the following Monday.
  const weekStart = new Date();
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);
  const plannedThisWeek = await prisma.contentDraft.count({
    where: { status: { in: ["ready", "staged"] }, scheduledFor: { gte: weekStart, lt: weekEnd } },
  });

  let line = "";
  if (lastPublishedAt === null) {
    const everWritten = await prisma.contentDraft.count({ where: { status: { not: "discarded" } } });
    if (everWritten > 0) {
      line = `Nothing has ever been published — ${everWritten} draft${everWritten === 1 ? "" : "s"} in the queue, zero out the door${plannedThisWeek > 0 ? `; ${plannedThisWeek} slotted this week, still your tap` : ""}.`;
    }
  } else if (daysSince !== null && daysSince >= 7) {
    line =
      `Nothing published in ${daysSince} days` +
      (plannedThisWeek > 0
        ? ` — ${plannedThisWeek} slot${plannedThisWeek === 1 ? "" : "s"} planned this week, still your tap to publish.`
        : " — and no slots planned this week either.");
  }

  return { lastPublishedAt, daysSince, plannedThisWeek, line };
}

/**
 * The honest state of the content pipeline, for the Business page and the
 * risk line. Reports zero as zero: a queue full of unpublished drafts is not
 * output, and saying so is the only way it stops being one.
 */
export async function queueState(): Promise<{
  draft: number; ready: number; staged: number; published: number;
  headline: string;
}> {
  const rows = await prisma.contentDraft.groupBy({ by: ["status"], _count: { _all: true } });
  const n = (s: string) => rows.find((r) => r.status === s)?._count._all ?? 0;
  const draft = n("draft"), ready = n("ready"), staged = n("staged"), published = n("published");

  let headline: string;
  if (draft + ready + staged + published === 0) {
    headline = "Nothing written yet. Copy you generate and don't keep is the same as copy you never wrote.";
  } else if (published === 0) {
    headline =
      `${draft + ready} written, ${staged} waiting on your confirm, none published. ` +
      `A full queue isn't output — publishing is.`;
  } else {
    headline = `${published} published · ${ready} ready to go · ${draft} still drafts${staged ? ` · ${staged} awaiting your confirm` : ""}.`;
  }
  return { draft, ready, staged, published, headline };
}
