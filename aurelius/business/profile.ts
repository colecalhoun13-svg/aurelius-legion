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
    key: "online_proof_model",
    value:
      "Cole's ruling: an online offer sells OUTCOMES, not numbers. The test battery stays the local proof model (Cole holds the timer, the numbers are trustworthy). Online promises what the athlete and parent can verify themselves without instruments — made the team, earned the starting spot, played a full season healthy, moved to a more demanding role, and knows how to train without being told.",
    note:
      "Cole's own call, and it resolves the online measurement problem rather than working around it. Two proof models for two channels, one method underneath: numbers where they're trustworthy, outcomes where they're self-evident. It also lands closer to the buyer's real job than numbers ever did — a parent doesn't buy 0.15s, they buy their kid making varsity. And Cole's differentiator (an athlete who understands and can leverage their own body) is itself an outcome, not a metric, so online finally sells the actual edge.",
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
  /** What stays impossible while this is unknown. */
  blocks: string;
  /** Lower runs first — ordered by what unblocks the most. */
  priority: number;
};

/**
 * What Aurelius genuinely does NOT know. Asked one at a time (weekly
 * planning, or on demand); answering any of these is an explicit Cole
 * action and writes straight to knowledge — no confirm round-trip needed
 * for his own stated truth.
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
    key: "outcomes_owned",
    question:
      "Online sells outcomes — so which ones will you actually stand behind? Making the team, earning a starting spot, a healthy full season, training without being told? Name the one or two you'd put your name on.",
    blocks:
      "The online promise itself. An outcome offer needs a specific outcome, and Cole has to choose which ones he's willing to be accountable for.",
    priority: 9,
  },
  {
    key: "outcome_checkin",
    question:
      "If the promise is an outcome, you have to know whether it happened. How would you find out — a season-end check-in, a message when they get the news, a parent call?",
    blocks:
      "Whether the online offer can prove itself. An outcome nobody records is a promise that never becomes proof for the next buyer.",
    priority: 10,
  },
];

/** The scope every business fact lives under in Living Knowledge. */
export const BUSINESS_SCOPE = "business";
