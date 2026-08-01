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

export type BusinessFact = {
  key: string;
  value: string;
  /** Why this fact matters downstream — kept out of the prompt, used in receipts. */
  note: string;
};

/** Stated by Cole, 2026-07-31. Every line traceable to his own answer. */
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
    key: "delivery_now",
    value:
      "In-person coaching at the gym where Cole works. This is the live, proven delivery channel today.",
    note: "Any near-term offer must be deliverable HERE without new infrastructure.",
  },
  {
    key: "near_term_goal",
    value:
      "Grow the high-school athlete population at the gym Cole works at. This is the concrete, current objective — not an abstract growth target.",
    note: "The near-term marketing job. Local and specific beats an online empire fantasy.",
  },
  {
    key: "exploring",
    value:
      "Remote/online coaching is under consideration, not committed. Not yet a channel, and not yet an offer.",
    note:
      "Held as EXPLORATION so Aurelius never speaks about it as if it exists. Online changes the business shape (product, distribution, retention, proof) — it is a separate decision, not an extension of in-person.",
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
    key: "gym_arrangement",
    question:
      "What's your arrangement with the gym — employed, contractor, revenue share, renting space? And can you sell your own offer there, or does everything go through the gym?",
    blocks: "Any offer at all — this decides what Cole is even allowed to sell and who owns the client.",
    priority: 1,
  },
  {
    key: "capacity",
    question:
      "How many athletes can you actually take on right now, and how many hours a week can you give them?",
    blocks: "Pricing and format — an offer that outruns capacity is a promise Cole can't keep.",
    priority: 2,
  },
  {
    key: "current_pricing",
    question:
      "What do athletes pay today — per session, per month, or through the gym's membership? Include what the gym charges even if you don't set it.",
    blocks: "Every price decision, and the value gap between what's charged and what's delivered.",
    priority: 3,
  },
  {
    key: "proof_assets",
    question:
      "Do you have any of your before/after numbers written down somewhere — a spreadsheet, an app, a notebook? And do you have permission to share any athlete's results by name?",
    blocks:
      "The proof engine. Cole's measured outcomes are his biggest asset and they're currently invisible to buyers.",
    priority: 4,
  },
  {
    key: "buyer_reality",
    question:
      "When a high-school athlete starts with you, who actually found you and who pays — the athlete, the parent, or a coach's referral?",
    blocks: "Who the marketing talks to. Writing to athletes when parents buy is money set on fire.",
    priority: 5,
  },
  {
    key: "season_shape",
    question:
      "How does demand move through the year — off-season surge, in-season drop, tryout season? When do athletes actually come looking?",
    blocks: "Timing. The right offer launched in the wrong month reads as failure.",
    priority: 6,
  },
  {
    key: "format_preference",
    question:
      "Which do you want the core offer to be — 1:1, small group (2–6), or a team/squad model? What do you actually enjoy coaching?",
    blocks: "Offer construction and the economics underneath it.",
    priority: 7,
  },
  {
    key: "online_intent",
    question:
      "If online happened, who is it for — your local athletes between sessions, athletes too far to train with you, or other coaches wanting your method?",
    blocks: "Whether online is a retention tool, a new market, or a product. Three different businesses.",
    priority: 8,
  },
  {
    key: "the_standard",
    question:
      "You're a standard-setter, not a promise guy — so say the standard out loud. What does an athlete have to be able to DO to be physically competent and hard to injure in their sport? Three or four things is plenty.",
    blocks:
      "The entire message. A requirement-based offer lives or dies on the requirement being specific: 'get stronger' is nothing; 'decelerate under control off either leg' is a standard an athlete can be held to and a parent can understand.",
    priority: 9,
  },
];

/** The scope every business fact lives under in Living Knowledge. */
export const BUSINESS_SCOPE = "business";
