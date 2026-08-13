// aurelius/tools/adapters/business.ts
//
// The business foundation, drivable from chat. Read-and-elicit only —
// nothing outward, nothing published. Offers land as proposals for Cole's
// confirm (an offer is his decision by construction).

import type { ToolAdapter, ToolAdapterResult } from "../types.ts";

export const businessAdapter: ToolAdapter = {
  name: "business",
  description:
    "Cole's business foundation: what's confirmed, what's still unknown, and drafting an offer from the confirmed facts. Pre-offer by design — it elicits Cole's truth, never invents it.",
  actions: [
    {
      name: "propose_angles",
      description:
        "Propose research-backed MARKETING ANGLES for the remote business — testable hypotheses about what will make a specific person reply. Runs a real research pass first and reports its grounding honestly: if it could not retrieve sources it SAYS the angles are model priors, not findings. Use for 'what should I be saying', 'help me market', 'what angle works'.",
      dataSchema: "{ count?: number (1-6, default 3), audience?: string }",
    },
    {
      name: "draft_asset",
      description:
        "Write one marketing asset FROM an angle — email, instagram_post, instagram_carousel, dm, or landing_section. Carries the angle's grounding with it so Cole is never handed copy without being told how much to trust the idea underneath. INWARD: drafts only, never publishes or sends.",
      dataSchema: '{ angleId: string, format: "email"|"instagram_post"|"instagram_carousel"|"dm"|"landing_section" }',
    },
    {
      name: "record_outcome",
      description:
        "Record what actually HAPPENED to an angle — how many times used, how many replied, how many converted, and optionally which lead it produced. This is what makes Cole's own market data outrank generic research over time.",
      dataSchema: "{ angleId: string, used?: number, replies?: number, conversions?: number, leadId?: string }",
    },
    {
      name: "angle_performance",
      description:
        "What Cole's own results say about which angles work — with an honest read on whether the sample is big enough to mean anything yet. Use for 'what's working', 'which angle should I use'.",
      dataSchema: "{} (no fields)",
    },
    {
      name: "draft_offer",
      description:
        "Draft ONE concrete offer as a real, durable draft — name, who it's for, the promise, the shape (monthly/block/program), what happens week to week, and the proof. Research-informed and honestly labelled. NEVER sets a price: Cole has not set remote pricing, and a guessed number would get quoted to a buyer. Use for 'what should I sell', 'build me an offer', 'what's my package'.",
      dataSchema: '{ shape?: "monthly"|"block"|"program" }',
    },
    {
      name: "list_offers",
      description:
        "Cole's offers and their state — drafts, what's live, what's retired — plus whether marketing currently has anything to point at. Use for 'what am I selling', 'what's my offer'.",
      dataSchema: '{ status?: "draft"|"active"|"retired" }',
    },
    {
      name: "activate_offer",
      description:
        "Make a drafted offer LIVE, with its price in cents. Refuses without a price — activating is what makes marketing and outreach quote it. This is Cole's decision; never do it unprompted.",
      dataSchema: "{ offerId: string, priceCents: number }",
    },
    {
      name: "retire_offer",
      description: "Stop selling an offer. Kept for attribution, never surfaced as current again.",
      dataSchema: "{ offerId: string }",
    },
    {
      name: "snapshot",
      description:
        "Where the business actually stands: confirmed facts, open questions, and what each gap is blocking. Use when Cole asks about his business, positioning, offers, or 'what do you know about my business'.",
      dataSchema: "{}",
      example: "[TOOL: tool=business action=snapshot data={}]",
    },
    {
      name: "next_question",
      description:
        "The single most-unblocking thing Aurelius doesn't know yet, phrased as one direct question. Use when Cole asks what you need from him, or when a business answer is blocked by a gap.",
      dataSchema: "{}",
      example: "[TOOL: tool=business action=next_question data={}]",
    },
    {
      name: "answer",
      description:
        "Record Cole's answer to one of the open business questions. His own truth about his own business — applies immediately, no confirm round-trip.",
      dataSchema: '{ "key": string (the question key from snapshot/next_question), "answer": string }',
      example: '[TOOL: tool=business action=answer data={"key": "capacity", "answer": "10 athletes, about 12 hours a week"}]',
    },
    {
      name: "draft_offer",
      description:
        "Draft an offer from the confirmed facts and file it as a proposal for Cole to confirm/correct/deny. Unknowns are marked as assumptions in the draft — never a reason to refuse.",
      dataSchema: "{}",
      example: "[TOOL: tool=business action=draft_offer data={}]",
    },
    {
      name: "aim_research",
      description:
        "Re-point the Sunday research sweep at Cole's actual situation, derived from his confirmed facts and current top unknown. Use after his business facts change materially.",
      dataSchema: "{}",
      example: "[TOOL: tool=business action=aim_research data={}]",
    },
    {
      name: "options",
      description:
        "THE DEFAULT for any marketing/growth/positioning question. Runs live research, then gives THREE genuinely different approaches grounded in Cole's facts — what each demands, where each fails, how to test it cheap. Deliberately does not converge on one recommendation: Cole decides, Aurelius informs. Use this instead of prescribing an answer.",
      dataSchema: '{ "question": string (what he\'s weighing — e.g. "how do I get more high school athletes into the gym") }',
      example: '[TOOL: tool=business action=options data={"question": "how should I get more varsity athletes in the door"}]',
    },
    {
      name: "research_partners",
      description:
        "Research NON-competing partnership candidates (apparel/gear/recovery/complementary brands — NEVER other gyms or PT clinics), grounded in Cole's positioning. Read-only: names and why, not outreach. Use for 'who could I partner with', 'find brand partners'.",
      dataSchema: "{}",
      example: "[TOOL: tool=business action=research_partners data={}]",
    },
    {
      name: "draft_partner_intro",
      description:
        "Draft an INWARD intro DM/email to a specific partner and mint a per-partner tracked link so a landed partnership is attributable. Drafts only — sending stays Cole's. Use for 'draft an intro to <brand>'.",
      dataSchema: "{ name: string, handle?: string, angle?: string }",
      example: '[TOOL: tool=business action=draft_partner_intro data={"name":"<brand>","angle":"co-branded speed program"}]',
    },
    {
      name: "probe_offer",
      description:
        "Float 2-3 offer VARIANTS behind tracked links to learn which framing pulls — consistent pricing, never per-lead. Inward: creates the probe + links, nothing outward. Use for 'test my offer framing', 'which package lands'.",
      dataSchema: "{ variants?: number (2-3) }",
      example: "[TOOL: tool=business action=probe_offer data={}]",
    },
    {
      name: "offer_probe_standing",
      description:
        "Where a running offer probe stands — which variant is pulling and whether there's enough signal to call it. Read-only. Use for 'how's the offer test going'.",
      dataSchema: "{}",
      example: "[TOOL: tool=business action=offer_probe_standing data={}]",
    },
    {
      name: "capacity",
      description:
        "Roster/capacity health: how many paying clients Cole has vs the remote capacity he can actually handle on top of the gym job, plus headroom. Honest when capacity isn't set (won't invent a ceiling). Gym athletes reported as a coaching load, never a business slot. Use for 'how full am I', 'can I take more clients', 'what's my capacity'.",
      dataSchema: "{}",
      example: "[TOOL: tool=business action=capacity data={}]",
    },
    {
      name: "productize",
      description:
        "RECOMMENDATIONS for turning time-for-money coaching into something repeatable (a named program, a self-serve template, a cohort). Recommends only — never builds a product or sets a price. Honest pre-data. Use for 'how do I scale', 'can I productize this', 'package my coaching'.",
      dataSchema: "{}",
      example: "[TOOL: tool=business action=productize data={}]",
    },
    {
      name: "flight_sim",
      description:
        "Model a business move BEFORE committing — 'raise the block to $350 and add 3 clients', 'go part-time at the gym'. Projects revenue/capacity/timeline against Cole's REAL numbers, names what has to be true, and the biggest risk. A model, not a promise — says its assumptions. Use for 'what if I…', 'should I raise my price', 'model this'.",
      dataSchema: "{ scenario: string }",
      example: '[TOOL: tool=business action=flight_sim data={"scenario":"raise the block to $350 and add 3 clients"}]',
    },
    {
      name: "discovery_prep",
      description:
        "A one-glance discovery-call prep sheet for a lead: the picture, qualifying questions, the offer to present, likely objections. Read-only. Use for 'prep me for the call with <lead>', 'discovery prep for <lead>'.",
      dataSchema: "{ leadId: string }",
      example: '[TOOL: tool=business action=discovery_prep data={"leadId":"abc"}]',
    },
    {
      name: "discovery_followup",
      description:
        "Draft the post-call follow-up for a lead, from the lead plus Cole's call notes. INWARD — a draft Cole reads and sends. Use for 'follow up with <lead> after the call'.",
      dataSchema: "{ leadId: string, notes?: string }",
      example: '[TOOL: tool=business action=discovery_followup data={"leadId":"abc","notes":"wants speed, budget tight, start in Sept"}]',
    },
    {
      name: "niche_wedge",
      description:
        "Find under-served NICHE WEDGES — specific athlete/sport/format spots the field leaves open that Cole's standard fits — for floating a new program or sharpening positioning. Research-grounded, honestly labelled (says when it's a hypothesis, not a finding). Use for 'where's my opening', 'what niche should I go after', 'new program idea'.",
      dataSchema: "{ topic?: string }",
      example: '[TOOL: tool=business action=niche_wedge data={"topic":"remote speed training for soccer"}]',
    },
    {
      name: "competitor_intel",
      description:
        "Competitor intel on OTHER remote coaches (never the gym Cole works for): how they position/promise, price signals, and the positioning gaps Cole could own. Research-grounded, honestly labelled, never fabricates a claim about a named competitor. Use for 'what are other coaches doing', 'competitor research', 'how do I stand out'.",
      dataSchema: "{ names?: string }",
      example: '[TOOL: tool=business action=competitor_intel data={}]',
    },
  ],
  async run(action, data): Promise<ToolAdapterResult> {
    // ── marketing: evidence-carrying, never a bare assertion ──
    if (action === "propose_angles" || action === "draft_asset" || action === "record_outcome" || action === "angle_performance") {
      try {
        const mk = await import("../../business/marketing.ts");
        if (action === "propose_angles") {
          const out = await mk.proposeAngles({ count: Number(data?.count) || undefined, audience: data?.audience });
          if (!out.ok) return { ok: false, output: null, error: out.error ?? "could not propose angles" };
          return {
            ok: true,
            output: {
              grounding: out.grounding,
              // Surfaced deliberately: Cole cannot audit marketing advice
              // himself, so how much to trust it must travel WITH it.
              trustThis: out.groundingNote,
              sources: out.sources,
              angles: out.angles,
              nextStep: "Pick one and draft an asset from it (business.draft_asset), then record what happens (business.record_outcome).",
            },
          };
        }
        if (action === "draft_asset") {
          if (!data?.angleId) throw new Error("draft_asset needs angleId (from propose_angles / angle_performance).");
          const out = await mk.draftAsset(String(data.angleId), data.format);
          if (!out.ok) return { ok: false, output: null, error: out.error ?? "draft failed" };
          return { ok: true, output: { angle: out.angle, grounding: out.grounding, trustThis: out.groundingNote, body: out.body } };
        }
        if (action === "record_outcome") {
          if (!data?.angleId) throw new Error("record_outcome needs angleId.");
          const out = await mk.recordOutcome(data as any);
          if (!out.ok) return { ok: false, output: null, error: out.error };
          return { ok: true, output: await mk.anglePerformance() };
        }
        return { ok: true, output: await mk.anglePerformance() };
      } catch (err: any) {
        return { ok: false, output: null, error: err?.message ?? String(err) };
      }
    }
    // ── offers: the artifact marketing and outreach point at ──
    if (action === "draft_offer" || action === "list_offers" || action === "activate_offer" || action === "retire_offer") {
      try {
        const O = await import("../../business/offers.ts");
        if (action === "draft_offer") {
          const out = await O.draftOffer({ shape: data?.shape });
          if (!out.ok) return { ok: false, output: null, error: out.error ?? "could not draft an offer" };
          return {
            ok: true,
            output: {
              offerId: out.offerId,
              offer: out.offer,
              grounding: out.grounding,
              trustThis: out.groundingNote,
              price: "not set — Aurelius will not pick a number for you",
              nextStep:
                "It's a DRAFT: nothing points at it yet. Read it, set the price you'd actually charge, then activate it (business.activate_offer).",
            },
          };
        }
        if (action === "list_offers") {
          const [offers, readiness] = await Promise.all([O.listOffers(data?.status), O.offerReadiness()]);
          return { ok: true, output: { headline: readiness.headline, blocker: readiness.blocker, offers } };
        }
        if (action === "activate_offer") {
          if (!data?.offerId) throw new Error("activate_offer needs offerId (from list_offers).");
          const out = await O.activateOffer(String(data.offerId), {
            priceCents: data?.priceCents != null ? Number(data.priceCents) : undefined,
          });
          if (!out.ok) return { ok: false, output: null, error: out.error };
          return { ok: true, output: { offer: out.offer, summary: "Live. Marketing and outreach now quote this exactly." } };
        }
        if (!data?.offerId) throw new Error("retire_offer needs offerId.");
        const out = await O.retireOffer(String(data.offerId));
        if (!out.ok) return { ok: false, output: null, error: out.error };
        return { ok: true, output: await O.offerReadiness() };
      } catch (err: any) {
        return { ok: false, output: null, error: err?.message ?? String(err) };
      }
    }

    // ── partnerships (non-competing) + offer probe: inward growth ──
    if (action === "research_partners" || action === "draft_partner_intro" || action === "probe_offer" || action === "offer_probe_standing") {
      try {
        if (action === "research_partners") {
          const { researchPartners } = await import("../../business/partnership.ts");
          const out = await researchPartners();
          if (!out.ok) return { ok: false, output: null, error: out.suggestions };
          return { ok: true, output: { suggestions: out.suggestions, trustThis: out.grounding } };
        }
        if (action === "draft_partner_intro") {
          if (!data?.name) throw new Error("draft_partner_intro needs a partner name.");
          const { draftPartnerIntro } = await import("../../business/partnership.ts");
          const out = await draftPartnerIntro({ name: String(data.name), handle: data?.handle, angle: data?.angle });
          if (!out.ok) return { ok: false, output: null, error: out.error };
          return {
            ok: true,
            output: { body: out.body, trackedLink: out.refUrl, note: "Inward draft — send it yourself. The link makes a landed partnership attributable." },
          };
        }
        if (action === "probe_offer") {
          const { probeOffer } = await import("../../business/offers.ts");
          const out = await probeOffer({ variants: data?.variants != null ? Number(data.variants) : undefined });
          if (!out.ok) return { ok: false, output: null, error: out.error };
          return { ok: true, output: out };
        }
        const { offerProbeStanding } = await import("../../business/offers.ts");
        return { ok: true, output: await offerProbeStanding() };
      } catch (err: any) {
        return { ok: false, output: null, error: err?.message ?? String(err) };
      }
    }

    // ── capacity health + productization: business intelligence reads ──
    if (action === "capacity" || action === "productize") {
      try {
        if (action === "capacity") {
          const { capacityHealth } = await import("../../business/capacity.ts");
          return { ok: true, output: await capacityHealth() };
        }
        const { productizationRecommendations } = await import("../../business/productization.ts");
        const out = await productizationRecommendations();
        if (!out.ok) return { ok: false, output: null, error: out.error };
        return { ok: true, output: { recommendations: out.recommendations, trustThis: out.grounding } };
      } catch (err: any) {
        return { ok: false, output: null, error: err?.message ?? String(err) };
      }
    }

    // ── planning: flight-sim (what-if) + discovery-call co-pilot ──
    if (action === "flight_sim" || action === "discovery_prep" || action === "discovery_followup") {
      try {
        if (action === "flight_sim") {
          const { flightSimulate } = await import("../../business/flightSim.ts");
          const out = await flightSimulate(String(data?.scenario ?? ""));
          if (!out.ok) return { ok: false, output: null, error: out.error };
          return { ok: true, output: { projection: out.projection, trustThis: out.grounding } };
        }
        if (!data?.leadId) throw new Error(`${action} needs a leadId.`);
        const D = await import("../../business/discovery.ts");
        if (action === "discovery_prep") {
          const out = await D.discoveryPrep(String(data.leadId));
          if (!out.ok) return { ok: false, output: null, error: out.error };
          return { ok: true, output: { sheet: out.sheet } };
        }
        const out = await D.discoveryFollowup(String(data.leadId), data?.notes ? String(data.notes) : undefined);
        if (!out.ok) return { ok: false, output: null, error: out.error };
        return { ok: true, output: { body: out.body, note: "Inward draft — read it, then send it yourself." } };
      } catch (err: any) {
        return { ok: false, output: null, error: err?.message ?? String(err) };
      }
    }

    // ── market intel: niche wedges + competitor positioning (research-backed) ──
    if (action === "niche_wedge" || action === "competitor_intel") {
      try {
        const M = await import("../../business/marketIntel.ts");
        if (action === "niche_wedge") {
          const out = await M.nicheWedge(data?.topic ? String(data.topic) : undefined);
          if (!out.ok) return { ok: false, output: null, error: out.error };
          return { ok: true, output: { wedges: out.wedge, trustThis: out.grounding, sources: out.sources } };
        }
        const out = await M.competitorIntel(data?.names ? String(data.names) : undefined);
        if (!out.ok) return { ok: false, output: null, error: out.error };
        return { ok: true, output: { intel: out.intel, trustThis: out.grounding, sources: out.sources } };
      } catch (err: any) {
        return { ok: false, output: null, error: err?.message ?? String(err) };
      }
    }

    const P = await import("../../business/positioning.ts");
    try {
      if (action === "snapshot") {
        const snap = await P.businessSnapshot();
        return { ok: true, output: snap };
      }
      if (action === "next_question") {
        const gaps = await P.openGaps();
        if (gaps.length === 0) {
          return { ok: true, output: { question: null, summary: "Nothing outstanding — every business question is answered." } };
        }
        const q = gaps[0]!;
        return {
          ok: true,
          output: { key: q.key, question: q.question, blocks: q.blocks, remaining: gaps.length, summary: q.question },
        };
      }
      if (action === "answer") {
        const key = (data?.key ?? "").toString().trim();
        const answer = (data?.answer ?? "").toString().trim();
        const r = await P.recordGapAnswer(key, answer);
        if (!r.ok) return { ok: false, output: null, error: r.error ?? "could not record that" };
        const left = (await P.openGaps()).length;
        return { ok: true, output: { recorded: key, openQuestionsLeft: left, summary: `Filed under business.${key}. ${left} question(s) left.` } };
      }
      if (action === "draft_offer") {
        // Backend tsconfig runs non-strict, so discriminated-union narrowing
        // isn't reliable here — read the shape explicitly instead.
        const r: any = await P.proposeOffer();
        if (!r?.ok) {
          return { ok: false, output: { askFirst: r?.askFirst ?? [] }, error: r?.error ?? "could not draft an offer" };
        }
        return {
          ok: true,
          output: { offer: r.proposal, proposalId: r.proposalId, summary: "Offer drafted — it's on the Bridge for your confirm, correction, or bin." },
        };
      }
      if (action === "aim_research") {
        const t = await P.deriveStandingTopics();
        return {
          ok: true,
          output: {
            business: t.business,
            content: t.content,
            summary: `Research lane re-aimed: ${t.business.length} business topic(s), ${t.content.length} content topic(s). The Sunday sweep works these from now on.`,
          },
        };
      }
      if (action === "options") {
        const r: any = await P.marketingOptions((data?.question ?? "").toString());
        if (!r?.ok) return { ok: false, output: null, error: r?.error ?? "could not explore that" };
        return {
          ok: true,
          output: {
            options: r.options,
            grounding: r.grounding,
            summary: `Three approaches, ${r.grounding === "external" ? "research-grounded" : "from Aurelius's own knowledge (no external source retrieved)"} — Cole's call.`,
          },
        };
      }
      return { ok: false, output: null, error: `unknown business action: ${action}` };
    } catch (e: any) {
      return { ok: false, output: null, error: e?.message ?? "business tool failed" };
    }
  },
};
