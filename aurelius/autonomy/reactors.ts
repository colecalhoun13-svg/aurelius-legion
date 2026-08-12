// aurelius/autonomy/reactors.ts
//
// THE REACTORS — policy on top of the event bus (core/events.ts is mechanism).
//
// A reactor is a named subscription: "when THIS happens, do THAT." They are the
// reactive half of Aurelius's autonomy — the scheduled spine acts on the clock,
// reactors act on events. Every reactor obeys the same constitution: it may
// finalize INWARD work inside a Cole-granted class (or file a proposal), and it
// never sends/publishes/spends on its own. Handlers stay THIN — they decide
// whether to act and delegate the actual work to the domain engine that already
// owns it (here: leadEngine.draftOutreach), so there is one implementation of
// "draft an outreach message", not two.
//
// Registered once at boot by registerAllReactors() (index.ts), mirroring
// registerAllActions(). That call is the named invoker: no reactor is live
// until it's wired here, and the boot log prints the count so the wiring is
// visible, not assumed (repo rule 8).

import { on, eventHandlerCount, listEventHandlers } from "../core/events.ts";

// A viral day or an abuse spike could fire many lead.inbound events. Auto-
// drafting each one is an LLM call AND a Bridge signal Cole has to review —
// the exact "a funded key multiplies generation without touching his review
// capacity" failure the outreach sweep is capped for. So auto-draft is capped
// per day; past the cap the lead is still captured and still surfaced (the
// inbound signal fires regardless), it just isn't auto-drafted — Cole can say
// "draft a reply to <name>" for those. The cap counts drafts actually created
// today, so a quiet day never wastes the budget.
const AUTO_DRAFT_DAILY_CAP = Math.max(1, Number(process.env.INBOUND_AUTODRAFT_CAP) || 5);

async function autoDraftsToday(): Promise<number> {
  const { prisma } = await import("../core/db/prisma.ts");
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  // Count the auto-draft signals this reactor filed today. sourceId is prefixed
  // so a manual "draft a reply" (same sourceType, different origin) isn't
  // double-counted against the reactive budget.
  return prisma.bridgeSignal
    .count({
      where: {
        sourceType: "outreach_draft",
        createdAt: { gte: dayStart },
        sourceId: { startsWith: "outreach:" },
      },
    })
    .catch(() => 0);
}

/**
 * FLAGSHIP reaction (#26): a lead arrives → the reply is already drafted,
 * waiting for Cole's one tap. This is the difference between "a lead came in,
 * go write something" and "here's the message, send it" — the whole point of
 * the lead-catch. Inward: draftOutreach only ever writes a Gmail draft (gated
 * or granted), never sends.
 */
export function registerAllReactors(): void {
  on("lead.inbound", "auto_draft_reply", async (e) => {
    // Can't draft an email reply to someone who left no email. The inbound
    // signal already nudged Cole to reach them another way; nothing to do here.
    if (!e.hasEmail) return;

    const drafted = await autoDraftsToday();
    if (drafted >= AUTO_DRAFT_DAILY_CAP) {
      console.log(
        `[reactors] lead.inbound ${e.name}: auto-draft cap reached (${drafted}/${AUTO_DRAFT_DAILY_CAP} today) — left for manual draft`
      );
      return;
    }

    const { draftOutreach } = await import("../crm/leadEngine.ts");
    const res = await draftOutreach(e.leadId);
    if (!res.ok) {
      // draftOutreach already guards against filing model-error text as a
      // message; a failure here means no draft was created. The lead + inbound
      // signal stand, so Cole still sees it — we just log why the auto-draft
      // didn't land.
      console.warn(`[reactors] lead.inbound ${e.name}: auto-draft failed — ${res.error}`);
      return;
    }
    console.log(
      `[reactors] lead.inbound ${e.name}: reply ${res.gated ? "proposed (awaiting confirm)" : "drafted"} for one-tap review`
    );
  });

  const handlers = listEventHandlers();
  console.log(
    `[reactors] wired ${eventHandlerCount()} reaction(s) across ${handlers.length} event type(s): ` +
      handlers.map((h) => `${h.type}[${h.handlers.join(",")}]`).join(" · ")
  );
}
