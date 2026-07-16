// aurelius/tools/adapters/content.ts
//
// The content operator as a REGISTERED TOOL — draft a post in Cole's voice, then
// (only on his confirm) publish it. This is the first OUTWARD-capable tool:
//
//   • draft_post   — INWARD. Writes a caption from a topic/notes; returns it for
//                    review. No side effects, nothing leaves the system.
//   • publish_post — OUTWARD. Never posts directly. It stages the publish through
//                    executeAction("content.publish"), which — because publishing
//                    is outward by construction — always GATES: a pending Bridge
//                    proposal Cole taps to confirm. Only his tap runs the actual
//                    Instagram publish (workflows/contentPublish.ts).
//
// So even though the model can call publish_post, it can never actually publish —
// it can only ask Cole. That's the §2.5 guarantee, enforced by the executor.

import type { ToolAdapter, ToolAdapterResult } from "../types.ts";
import { runLLM } from "../../llm/runLLM.ts";
import { extractDirectives } from "../../llm/directiveParser.ts";
import { executeAction } from "../../autonomy/executor.ts";
import { instagramConfigured } from "../../outward/instagram.ts";

export const contentAdapter: ToolAdapter = {
  name: "content",
  description:
    "Draft and publish content. draft_post writes a caption in Cole's voice (inward, no side effects). publish_post stages a post for Cole's one-tap confirm on the Bridge — it can NEVER publish on its own (publishing is outward; Cole confirms every time).",
  actions: [
    {
      name: "draft_post",
      description:
        "Draft a social caption/post in Cole's voice from a topic or notes. Returns the draft for review — does not publish. Use for 'draft an IG post about my squat PR'.",
      dataSchema: '{ topic: string, channel?: string (default "instagram"), notes?: string }',
      example: '[TOOL: content.draft_post {"topic": "hit a 500lb squat PR — 3-year journey", "channel": "instagram"}]',
    },
    {
      name: "publish_post",
      description:
        "Stage a post to publish. Files a confirmation on the Bridge — Cole taps to actually publish; it never posts on its own. Instagram needs a PUBLIC image_url. Use for 'publish that' / 'post this to Instagram'.",
      dataSchema: '{ caption: string, imageUrl: string (public URL), channel?: string (default "instagram") }',
      example: '[TOOL: content.publish_post {"caption": "500lb squat. 3 years.", "imageUrl": "https://.../pr.jpg"}]',
    },
  ],

  async run(action, data): Promise<ToolAdapterResult> {
    switch (action) {
      case "draft_post": {
        if (!data?.topic) return { ok: false, output: null, error: "topic required" };
        const channel = data.channel ? String(data.channel) : "instagram";
        const prompt = `
Draft a ${channel} post in Cole's voice — tactical, precise, no fluff, no
hashtag spam. Topic: ${String(data.topic)}.
${data.notes ? `Notes to weave in: ${String(data.notes)}\n` : ""}Return ONLY the caption text, ready to post. Keep it tight.`.trim();
        const res = await runLLM({ taskType: "chat", operators: { primary: "content", secondaries: [] }, input: prompt });
        const caption = extractDirectives(res.text ?? "").cleanedText || res.text;
        return {
          ok: true,
          output: {
            summary: `Drafted a ${channel} caption — review it, then say "publish it" with an image.`,
            channel,
            caption,
          },
        };
      }

      case "publish_post": {
        if (!data?.caption) return { ok: false, output: null, error: "caption required" };
        const channel = data.channel ? String(data.channel) : "instagram";
        if (channel === "instagram" && !data?.imageUrl) {
          return { ok: false, output: null, error: "Instagram needs a public imageUrl (Meta fetches the image itself)." };
        }
        const configured = instagramConfigured();
        // Stage the outward action → executeAction GATES it (pending Bridge confirm).
        const exec = await executeAction({
          actionClass: "content.publish",
          sourceType: "content_publish_request",
          prepare: async () => ({
            title: `Publish to ${channel}?`,
            body:
              `**Caption:**\n${String(data.caption)}\n\n${data.imageUrl ? `Image: ${String(data.imageUrl)}\n\n` : ""}` +
              (configured
                ? `Confirm to publish to ${channel}. Nothing goes out until you tap.`
                : `⚠️ ${channel} isn't connected yet (no token) — confirming will fail honestly until you set it up (docs/SETUP.md). Nothing goes out.`),
            domain: "content",
            payload: { channel, caption: String(data.caption), imageUrl: data.imageUrl ? String(data.imageUrl) : "" },
          }),
        });
        return {
          ok: true,
          output: {
            summary: `Staged a ${channel} post on the Bridge — tap Confirm to publish. I never post on my own.${configured ? "" : ` (${channel} not connected yet.)`}`,
            bridgeSignalId: exec.bridgeSignalId,
            gated: !exec.finalized,
          },
        };
      }

      default:
        return { ok: false, output: null, error: `unknown content action: ${action}` };
    }
  },
};
