// aurelius/business/profile.ts
//
// THE BUSINESS FOUNDATION — Cole's own words, not Aurelius's guesses.
//
// The Business Engine was parked because building it on inferred data
// produces confident nonsense. This module is the un-parking condition: the
// facts Cole actually stated, held as durable Living Knowledge so every
// business/content answer reasons FROM them instead of re-deriving a
// generic "youth athlete performance" persona each turn.
//
// Two halves, and the honesty is in the split:
//   CONFIRMED — Cole said it. Seeded to knowledge scope "business".
//   OPEN      — Aurelius does NOT know it. Never guessed, never filled by
//               inference; asked one at a time, and each names what it
//               BLOCKS so Cole can see the cost of the gap.
//
// Pre-offer by design: Cole has no offer stack yet. Nothing here pretends
// otherwise — the point is to get to one from what's real.
//
// 2026-08-05 — THE CORRECTION THAT REFRAMES EVERYTHING BELOW. Cole is
// EMPLOYED by the gym, and the remote/online business is his own and the
// reason Aurelius exists. This file previously encoded the opposite: local
// in-person as the real business, online as a maybe (`exploring`). Under
// that reading every offer Aurelius proposed aimed at athletes Cole isn't
// allowed to sell to. `exploring` is retired, `delivery_now` and
// `near_term_goal` are revised to keep the job and the business in separate
// columns, and the open questions now interrogate the remote business rather
// than a local one.

export type BusinessFact = {
  key: string;
  value: string;
  /** Why this fact matters downstream — kept out of the prompt, used in receipts. */
  note: string;
  /**
   * Bumped when COLE RESTATES a fact and the new answer supersedes the old one.
   *
   * The seeder is idempotent by design — it skips keys that already exist so a
   * later correction of Cole's outranks the seed. That's right for corrections
   * and wrong for restatements: when Cole answers the same question differently
   * (2026-08-05 made `delivery_now` and `near_term_goal` half-true), the stale
   * value stays live in the database forever and every business answer keeps
   * reasoning from it. Revisions fix that narrowly: a seeded entry is rewritten
   * ONLY when its stored revision is older than this one. An entry Cole edited
   * by hand carries a different sourceId and is never touched.
   */
  revision?: number;
};

/** The sourceId stamp that marks an entry as seed-written at a known revision. */
export const REVISION_SOURCE_PREFIX = "profile:rev";
export const factRevision = (f: BusinessFact): number => f.revision ?? 1;

/**
 * Facts that turned out to be WRONG, not merely stale — the key itself is the
 * lie, so bumping a revision can't fix it. The seeder deactivates these (soft,
 * history preserved). Retiring beats silent mutation: `exploring` didn't get a
 * new value, it stopped being a true description of anything.
 */
export const RETIRED_FACTS: { key: string; reason: string }[] = [
  {
    key: "exploring",
    reason:
      "Held remote coaching as 'under consideration, not committed.' Cole corrected this on 2026-08-05: the remote business is the whole point of Aurelius and the gym is the day job. Superseded by `the_business` — a fact under a key named 'exploring' would keep reading as tentative no matter what value it carried.",
  },
];

/** Stated by Cole, 2026-07-31 and 2026-08-05. Every line traceable to an answer. */
export const CONFIRMED_FACTS: BusinessFact[] = [
  {
    key: "who_i_serve",
    value:
      "Athletes across all sports plus general population, ages 5–99. The specialty and the strongest work is high-school through college athletes.",
    note: "Breadth is current reality; the specialty is where the leverage is.",
  },
  {
    key: "ideal_client",
    value:
      "Varsity high-school athletes. Cole's stated want: ten of them. Parents are typically the buyer at this age.",
    note: "The concentration target — every positioning decision serves this athlete.",
  },
  {
    key: "measured_outcomes",
    value:
      "Real, tracked performance metrics on every athlete: vertical jump, broad jump, 5-10-5 pro agility, top speed, and 10-yard dash. Concrete improvements produced across all of them.",
    note:
      "The rarest asset in this market. Most competitors sell effort and vibes; Cole has numbers. This is the proof engine's raw material.",
  },
  {
    key: "method_edge",
    value:
      "Cole trains the ATHLETE, not the knowledge base. The goal is physical AND mental competency: athletes learn to understand and leverage their own bodies so they can apply it inside their own sport — not follow instructions blindly.",
    note:
      "The real differentiator. Competing coaches sell compliance and programs; this sells transferable self-competency.",
  },
  {
    key: "gym_arrangement",
    value:
      "Cole is EMPLOYED by the gym. The gym owns the in-person athletes and the client relationship there — those are not Cole's clients to sell to, price, or migrate. The job is the income floor, not the business.",
    note:
      "Answered 2026-08-05; was open question #1. This is a hard boundary, not a detail. Aurelius must never propose an offer, outreach, price, or campaign that sells to the gym's athletes or competes with Cole's employer — that's his paycheck. Every revenue idea belongs to the remote business (`the_business`) unless Cole explicitly says otherwise.",
    revision: 1,
  },
  {
    key: "the_business",
    value:
      "The remote/online training business is Cole's OWN business, and building it is the reason Aurelius exists. Not exploration and not an extension of the gym work — it is the vehicle. The gym employment funds it while it grows.",
    note:
      "Stated 2026-08-05, superseding the retired `exploring` fact. This inverts the previous reading of Cole's situation: local was treated as the real business and online as a maybe. It is the other way round. Every business, content, and revenue answer should default to the remote business as the subject unless Cole is plainly talking about his job.",
    revision: 1,
  },
  {
    key: "remote_state",
    value:
      "Zero active remote clients right now. Cole has run remote coaching before using Google Sheets and text messages, so the delivery pattern is familiar — but the roster is empty today. This is a rebuild from zero, not a migration of an existing book.",
    note:
      "Stated 2026-08-05. Keeps Aurelius honest in both directions: it must not speak as if there's a client base to manage, and it must not treat Cole as a beginner who's never delivered remotely. The first paying remote client is the live objective.",
    revision: 1,
  },
  {
    key: "remote_delivery_today",
    value:
      "Programming in Google Sheets, check-ins by text. No platform, no athlete portal, no automation, nothing that scales. Cole wants Aurelius itself to become the delivery system — programming, check-ins, progress tracking — and possibly to host it.",
    note:
      "Stated 2026-08-05. Two consequences. (1) There is no incumbent tool to integrate with or work around — the field is clear. (2) Cole asked for Aurelius-as-delivery-platform, which is a substantially larger build than the CRM and is scoped as its own block; the CRM must stay delivery-agnostic so it doesn't have to be torn up when that lands.",
    revision: 1,
  },
  {
    key: "billing_shapes",
    value:
      "Three, and they coexist: monthly recurring coaching, fixed training blocks (8–12 weeks), and one-off program sales. Different athletes will be on different shapes — there is no single billing model.",
    note:
      "Stated 2026-08-05, and the hardest thing here to change later. The money layer models all three per-engagement rather than assuming a subscription: a block has an end date that IS the re-sign conversation, a monthly has a renewal that recurs until cancelled, and a program sale is one payment with no ongoing obligation. Collapsing these into one shape would quietly break two thirds of the revenue picture.",
    revision: 1,
  },
  {
    key: "lead_reality",
    value:
      "No inbound at all. No Instagram funnel, no referral flow, no email inquiries — nothing arrives on its own. Cole named lead generation as a primary reason he built Aurelius.",
    note:
      "Stated 2026-08-05, and this is the binding constraint. Aurelius should treat an empty pipeline as the top business problem and resist the temptation to present CRM machinery as progress: a pipeline with nothing in it earns nothing. The unblocking sequence is a defined offer, then a channel that creates demand, then capture. Say so when the subject comes up.",
    revision: 1,
  },
  {
    key: "delivery_now",
    value:
      "Two separate channels. IN-PERSON at the gym is Cole's employment — proven, live, and the gym's client relationship, not his. REMOTE/online is Cole's own business and currently has no clients; it has previously been delivered by Google Sheets and text.",
    note:
      "Revised 2026-08-05. The original read 'in-person at the gym' as the one true delivery channel, which made every offer suggestion aim at athletes Cole isn't allowed to sell to. Splitting the two keeps 'what's proven' and 'what's his' from being confused for each other — they're different columns.",
    revision: 2,
  },
  {
    key: "near_term_goal",
    value:
      "Two goals in two columns. EMPLOYMENT: grow the high-school athlete population at the gym Cole works at — that's the job done well. BUSINESS: land the first paying remote client and build toward a repeatable way of finding them.",
    note:
      "Revised 2026-08-05. The original named only the gym goal, so Aurelius optimized Cole's employer's growth and called it his business strategy. Both are real and they are not the same objective — gym growth is performance at work, remote revenue is equity in something he owns. When they compete for Cole's hours, that's a genuine trade-off to surface, not to silently resolve.",
    revision: 2,
  },
  {
    key: "market_posture",
    value:
      "Cole is NOT a promise/guarantee coach and does not want to be. His posture is the standard-setter: 'this is what's required for physical competency, to stay uninjured, and to be able to achieve what you're after.' He states the requirement and holds it — he does not guarantee an outcome, because the athlete owns the outcome.",
    note:
      "Cole's own words, and the correct read of his whole method. Guaranteeing outcomes would CONTRADICT the competency edge — it moves agency back onto the coach, when the entire point is transferring it to the athlete. Never write him promise-style marketing ('we'll get you X'); write requirement and capability ('here's what it takes, here's why, here's how you'll know'). Trade-off he should know and has accepted: this converts slower than guarantee marketing and creates less urgency, but it earns better-fit athletes, survives contact with reality, and carries no blame risk when a coach's decision goes the other way.",
  },
  {
    key: "online_proof_model",
    value:
      "The test battery stays the LOCAL proof model — Cole holds the timer, so those numbers are trustworthy and belong to the in-person offer. Online is not sold on numbers. What travels online is capability and requirement, tracked through the athlete's own sheet numbers and the videos they send in.",
    note:
      "Refined by Cole after the first pass: he rejected outcome-PROMISES as not who he is (see market_posture), so online sells the requirement and the competency, not a guaranteed result. Two proof models, one method: coach-measured numbers locally, athlete-recorded numbers and video remotely.",
  },
  {
    key: "progress_tracking_online",
    value:
      "For remote athletes, Cole would track progress through the numbers going up on their sheet and the videos they send him. Athlete-recorded, coach-reviewed.",
    note:
      "The numbers don't vanish online — their JOB changes. They stop being the sales claim and become (a) Cole's coaching instrument and (b) the athlete's own feedback loop. That second one is the method working: an athlete watching their own numbers is building exactly the self-awareness Cole is trying to transfer. Marketing must not quote self-recorded times as proof (measurement_constraint), but coaching absolutely uses them.",
  },
  {
    key: "measurement_constraint",
    value:
      "The performance battery is COACH-measured in person — that's what makes the numbers trustworthy. Online, Cole can't hold the timer: the athlete would have to self-test. Broad jump and vertical survive self-testing with a strict protocol (tape measure, phone video, standardised setup). The 10-yard dash, 5-10-5 and top speed do NOT — hand-timing error (±0.2s) is larger than real improvement, so those numbers become noise without timing gates or GPS.",
    note:
      "Cole's own objection, and the real constraint on any online offer. It splits the battery into travels/doesn't-travel — which means an online promise must be built on the jumps plus movement-quality video, and must NOT claim sprint-time precision. Also the reason local-first is the sound sequence: in-person proof is airtight and becomes the asset that makes any later online offer credible.",
  },
];

export type OpenQuestion = {
  key: string;
  /** Asked in Cole's register — direct, answerable in one line, no consultant fog. */
  question: string;
  /** What this SHARPENS if answered. Never a gate. */
  blocks: string;
  /** Lower = more useful to know early. Not a sequence he must march through. */
  priority: number;
};

/**
 * What Aurelius genuinely does NOT know — held as SHARPENERS, not a funnel.
 *
 * Cole's ruling (2026-07-31): "the whole goal of Aurelius is to be modular
 * and adaptable to what I need and leverage. To use research as a tool to
 * make the best informed decisions and not be stuck in one way of
 * thinking." So this list is NOT an interrogation script and NOT a gate on
 * doing work. Nothing here blocks a draft, an option, or an answer —
 * unknowns get marked as assumptions and the work proceeds. Answering one
 * makes the next pass sharper; ignoring all of them costs precision, never
 * capability.
 *
 * Answering is an explicit Cole action and writes straight to knowledge —
 * no confirm round-trip for his own stated truth.
 */
export const OPEN_QUESTIONS: OpenQuestion[] = [
  {
    key: "first_ten",
    question:
      "Forget marketing for a second — who are the ten people you could message this week who might actually say yes, or who know someone who would? Old athletes, their parents, coaches you know, people who've asked before.",
    blocks:
      "The empty pipeline, which is the binding constraint. Cole has zero remote clients and zero inbound, and the first ones almost never come from a funnel — they come from the warm list. This is the shortest path from nothing to a first paying client, and it's a list only Cole can write.",
    priority: 1,
  },
  {
    key: "the_standard",
    question:
      "You're a standard-setter, not a promise guy — so say the standard out loud. What does an athlete have to be able to DO to be physically competent and hard to injure in their sport? Three or four things is plenty.",
    blocks:
      "The entire message, and now the offer too. A requirement-based offer lives or dies on the requirement being specific: 'get stronger' is nothing; 'decelerate under control off either leg' is a standard an athlete can be held to and a parent can understand. With remote as the business, this is also the product spec.",
    priority: 2,
  },
  {
    key: "remote_pricing",
    question:
      "What would you charge remotely for each of the three — monthly coaching, an 8–12 week block, and a program on its own? Rough numbers are fine; I'd rather have your instinct than a market average.",
    blocks:
      "Every revenue projection and the whole capacity-vs-income picture. Three billing shapes with no prices attached means the money layer can record what happened but can't help Cole decide anything.",
    priority: 3,
  },
  {
    key: "remote_capacity",
    question:
      "How many remote athletes could you actually handle on top of the gym job, and how many hours a week does that realistically take?",
    blocks:
      "Pricing and sequencing. Remote is the second job on top of full-time employment — an offer that outruns the hours Cole actually has is a promise he can't keep, and it's the most common way a coaching side-business collapses.",
    priority: 4,
  },
  {
    key: "remote_audience",
    question:
      "Who is the remote offer for — athletes too far away to train with you in person, athletes who train elsewhere and want your programming, or other coaches who want your method?",
    blocks:
      "Whether this is a service business or a product business. Three different customers, three different price points, three different ways of finding them. Reworded from the old `online_intent` now that remote is committed rather than hypothetical.",
    priority: 5,
  },
  {
    key: "proof_assets",
    question:
      "Do you have any of your before/after numbers written down somewhere — a spreadsheet, an app, a notebook? And do you have permission to share any athlete's results by name?",
    blocks:
      "The proof engine. Cole's measured outcomes are his biggest asset and they're currently invisible to buyers — which matters more remotely, where nobody has watched him coach. Note the permission half is a real constraint: these are often minors.",
    priority: 6,
  },
  {
    key: "delivery_scope",
    question:
      "You said you'd want Aurelius to be the delivery platform. How far does that go — just replacing the Sheet and the check-in texts, or an actual athlete-facing portal where they log in, see their program, and send video?",
    blocks:
      "The size of the delivery build, which is much larger than the CRM. The first version is a weekend; the second is a product with logins, video storage, and someone else's data to keep safe.",
    priority: 7,
  },
  {
    key: "buyer_reality",
    question:
      "When a high-school athlete starts with you, who actually found you and who pays — the athlete, the parent, or a coach's referral?",
    blocks: "Who the marketing talks to. Writing to athletes when parents buy is money set on fire.",
    priority: 8,
  },
  {
    key: "season_shape",
    question:
      "How does demand move through the year — off-season surge, in-season drop, tryout season? When do athletes actually come looking?",
    blocks: "Timing. The right offer launched in the wrong month reads as failure.",
    priority: 9,
  },
  {
    key: "format_preference",
    question:
      "Which do you want the remote offer to be — 1:1, small group, or a team/squad model? What do you actually enjoy coaching?",
    blocks: "Offer construction and the economics underneath it.",
    priority: 10,
  },
  {
    key: "current_pricing",
    question:
      "What do athletes pay at the gym today — per session, per month, or through a membership? You don't set it, but I want the number as a reference point.",
    blocks:
      "A price anchor for the remote offer. Not a decision input the way it was when in-person was assumed to be the business — the gym's pricing is the gym's, and Cole's remote price is his own call.",
    priority: 11,
  },
];

/** The scope every business fact lives under in Living Knowledge. */
export const BUSINESS_SCOPE = "business";
