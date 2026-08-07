// aurelius/autonomy/workflows/contentPublish.ts
//
// The OUTWARD publish workflow (NORTH_STAR §2.5). content.publish is outward by
// construction, so executeAction always GATES it: it files a pending Bridge
// proposal and this finalizer runs ONLY when Cole taps Confirm. There is no
// grant that can make publishing automatic — that's the whole point.
//
// The finalizer commits from the stored payload (caption + public image URL), so
// it works even after a restart. Dormant-honest without an Instagram token.
//
// It also STAMPS the post (OutwardArtifact) with the platform object id the
// publish call used to drop on the floor, and mints a tracked bio-link so the
// leads that post produces can be traced back to it. Both are best-effort: a
// bookkeeping failure must never undo a real publish.

import { publishToInstagram } from "../../outward/instagram.ts";
import { prisma } from "../../core/db/prisma.ts";

export type ContentPublishPayload = {
  channel?: string; // "instagram" (only channel for now)
  caption: string;
  imageUrl: string;
  /** Set when the post came from the content queue, so the row can close out. */
  draftId?: string;
};

/** Commit step — registered as the content.publish finalizer. Runs on Cole's confirm. */
export async function finalizeContentPublish(payload: ContentPublishPayload): Promise<any> {
  const channel = (payload?.channel ?? "instagram").toLowerCase();
  if (channel !== "instagram") {
    throw new Error(`no publisher wired for channel "${channel}" (only instagram today)`);
  }
  const result = await publishToInstagram({ caption: payload.caption, imageUrl: payload.imageUrl });
  const postId = (result as any)?.postId ?? null;
  const permalink = (result as any)?.permalink ?? null;

  // ── Authorship stamp + tracked bio-link ──────────────────────────────
  // The post is real now, so record what it was and mint the link that lets
  // its leads be attributed. Everything here is wrapped: a failed stamp cannot
  // roll back the publish that already happened.
  let bioLink: { url: string; absolute: boolean; note?: string } | undefined;
  let artifactId: string | undefined;
  try {
    const draft = payload.draftId
      ? await prisma.contentDraft.findUnique({ where: { id: payload.draftId }, select: { angleId: true } })
      : null;
    const angleIds = draft?.angleId ? [draft.angleId] : [];

    const { mintTrackLink, trackLinkUrl } = await import("../../crm/trackLinks.ts");
    const link = await mintTrackLink({
      channel: "instagram",
      angleId: draft?.angleId ?? null,
      label: `IG post ${new Date().toISOString().slice(0, 10)}`,
    });

    const artifact = await prisma.outwardArtifact.create({
      data: {
        draftId: payload.draftId ?? null,
        channel: "instagram",
        externalId: postId, // the durable platform object id — persisted, not dropped
        permalink,
        angleIds,
        trackLinkId: link.id,
      },
    });
    artifactId = artifact.id;
    await prisma.trackLink.update({ where: { id: link.id }, data: { artifactId: artifact.id } }).catch(() => {});
    bioLink = trackLinkUrl(link.code);

    // Hand Cole the link. This is a receipt, not a decision — but it carries a
    // thing he should DO (set it as the bio/story link), so it names that.
    const { surfaceSignal } = await import("../../core/bridge.ts");
    await surfaceSignal({
      kind: "background_result",
      domain: "content",
      sourceType: "content_publish",
      sourceId: `published:${artifact.id}`,
      severity: "info",
      title: "Published — here's the tracked link for it",
      body:
        `Your post is live${permalink ? ` (${permalink})` : ""}.\n\n` +
        `Tracked link for this post: ${bioLink.url}\n` +
        (bioLink.absolute
          ? `Put it in your bio (or the story link) so the leads it drives trace back to this exact post.`
          : `${bioLink.note}\n(For now it's a path, not a full URL — set the origin and it becomes clickable.)`),
    }).catch(() => {});
  } catch (err: any) {
    console.warn("[contentPublish] stamp/link failed (non-fatal):", err?.message ?? err);
  }

  // Close the loop back to the queue. AFTER the publish call, never before:
  // "staged" and "published" are different facts, and marking the second
  // early is how a system starts reporting work it didn't actually do.
  if (payload.draftId) {
    const { markPublished } = await import("../../content/queue.ts");
    await markPublished(payload.draftId, permalink ?? undefined);
  }
  return { channel, ...result, artifactId, bioLink: bioLink?.url };
}
