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
    {
      name: "instagram_metrics",
      description:
        "Read-only Instagram performance: followers, reach, profile views over the last 30 days, plus recent posts and the top performer. Use for 'how's my Instagram doing', 'what's my reach', 'which post landed best'.",
      dataSchema: "{} (no fields)",
      example: "[TOOL: content.instagram_metrics]",
    },
    {
      name: "instagram_recent_posts",
      description:
        "Read-only per-post Instagram numbers for recent posts (reach, likes, comments, saves, engagement), newest first. Use for 'break down my last few posts'.",
      dataSchema: "{ limit?: number (default 8, max 25) }",
      example: '[TOOL: content.instagram_recent_posts {"limit": 6}]',
    },
    {
      name: "instagram_strategy",
      description:
        "Leverage read: analyzes Cole's own posting patterns (best day/time, best media type, engagement-rate trend) and returns concrete recommendations for what to post more of and when. Use for 'how do I grow my Instagram', 'what should I post', 'read my algorithm'.",
      dataSchema: "{} (no fields)",
      example: "[TOOL: content.instagram_strategy]",
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

      case "instagram_metrics": {
        try {
          const { metricsDigest } = await import("../../instagram/insights.ts");
          const digest = await metricsDigest();
          return { ok: true, output: { summary: digest } };
        } catch (err: any) {
          return { ok: false, output: null, error: err?.message ?? "couldn't read Instagram metrics" };
        }
      }

      case "instagram_recent_posts": {
        try {
          const { recentPostMetrics } = await import("../../instagram/insights.ts");
          const limit = Math.min(Math.max(Number(data?.limit) || 8, 1), 25);
          const posts = await recentPostMetrics(limit);
          return {
            ok: true,
            output: {
              summary: `${posts.length} recent post(s), newest first`,
              posts: posts.map((p) => ({
                date: new Date(p.timestamp).toLocaleDateString(),
                caption: p.caption,
                reach: p.reach,
                likes: p.likes,
                comments: p.comments,
                saves: p.saved,
                engagement: p.engagement,
                permalink: p.permalink,
              })),
            },
          };
        } catch (err: any) {
          return { ok: false, output: null, error: err?.message ?? "couldn't read recent posts" };
        }
      }

      case "instagram_strategy": {
        try {
          const { postingPatterns, accountMetrics } = await import("../../instagram/insights.ts");
          const patterns = await postingPatterns(25);
          if (patterns.sampleSize === 0) {
            return { ok: false, output: null, error: "No recent posts to analyze yet — post a few times, then ask again." };
          }
          const acct = await accountMetrics(30).catch(() => null);
          // Hand the REAL patterns to the content operator (which studies content
          // strategy via the curriculum) for a concrete, Cole-specific read.
          const brief =
            `Cole's Instagram data (his own posts — this IS his algorithm signal):\n` +
            `- ${patterns.sampleSize} recent posts · avg ${patterns.avgEngagement} engagement · ${patterns.avgReach} reach · ${patterns.engagementRatePct}% engagement rate · trend: ${patterns.trend}\n` +
            `- Best media type: ${patterns.bestMediaType ?? "n/a"}\n` +
            `- Best day: ${patterns.bestDay ?? "n/a"} · best time: ${patterns.bestHourBlock ?? "n/a"}\n` +
            `- By type: ${patterns.byMediaType.map((t) => `${t.type} ${t.avgEngagement}`).join(", ")}\n` +
            `- By day: ${patterns.byDay.map((d) => `${d.day} ${d.avgEngagement}`).join(", ")}\n` +
            (acct ? `- ${acct.followers} followers · ${acct.reach} reach last 30d\n` : "") +
            `\nGive Cole 3-4 concrete, specific moves to grow — what format to post more, when to post, ` +
            `what to double down on based on HIS numbers above. No generic advice; cite his data. Tight and tactical.`;
          const res = await runLLM({ taskType: "chat", operators: { primary: "content", secondaries: [] }, input: brief });
          const read = extractDirectives(res.text ?? "").cleanedText || res.text;
          return {
            ok: true,
            output: {
              summary: read,
              patterns: {
                sampleSize: patterns.sampleSize,
                engagementRatePct: patterns.engagementRatePct,
                trend: patterns.trend,
                bestDay: patterns.bestDay,
                bestTime: patterns.bestHourBlock,
                bestMediaType: patterns.bestMediaType,
              },
            },
          };
        } catch (err: any) {
          return { ok: false, output: null, error: err?.message ?? "couldn't build a strategy read" };
        }
      }

      default:
        return { ok: false, output: null, error: `unknown content action: ${action}` };
    }
  },
};
