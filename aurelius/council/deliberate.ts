// aurelius/council/deliberate.ts
//
// THE OPERATOR COUNCIL — deliberate(), the tribunal (Expansionist's phase-2).
//
// Everyday decisions get Decision Mode: the lens reasons THROUGH the frameworks
// silently and hands back one clean answer. But when Cole wants to SEE the minds
// argue — "council this" / "pressure-test this" — the disagreement is the value.
// This convenes the relevant operator lenses as INDEPENDENT seats: each reasons at
// full strength as primary (its own core + confirmed heuristics + field synthesis
// via buildSystemPrompt), gives its verdict and the one consideration its lens
// raises that others miss. Then a synthesis pass names where they agree, names the
// real tension, and resolves it in ONE voice (hard rule 2 — the seats are reasoning
// frames, never personalities).
//
// Opt-in only (N+1 LLM calls), so cost lands when Cole asks for a tribunal.
// Honest-failure: no engine → each seat/synthesis fails loudly; deliberate returns
// ok:false rather than inventing a verdict.

import { runLLM } from "../llm/runLLM.ts";
import { routeOperatorsSemantic } from "../router/operatorRouter.ts";
import { engineUnavailableText } from "../llm/nonAnswer.ts";

export type Seat = { operator: string; take: string; rebuttal?: string };
export type DeliberationResult = {
  ok: boolean;
  decision: string;
  seats: Seat[];
  synthesis: string;
  error?: string;
};

/** A seat's FINAL position — post-rebuttal when it survived, opening take otherwise. */
function finalPosition(s: Seat): string {
  return s.rebuttal ?? s.take;
}

const DEFAULT_MAX_SEATS = 3;

// The opt-in trigger — Cole explicitly asks to SEE the minds argue.
const COUNCIL_TRIGGER_RE =
  /^\s*(please\s+)?(convene the council( in the code)?|run the council|council this|pressure[- ]?test this|let the council|ask the council)\b/i;

/** True when Cole explicitly convenes the tribunal (vs. everyday invisible Decision Mode). */
export function isCouncilTrigger(message: string): boolean {
  return COUNCIL_TRIGGER_RE.test(message ?? "");
}

/** Strip a leading "council this / pressure-test this" trigger to get the decision. */
export function stripCouncilTrigger(message: string): string {
  return (message ?? "")
    .replace(/^\s*(please\s+)?(convene the council( in the code)?|run the council|council this|pressure[- ]?test this|let the council( weigh in| decide| sit)?|ask the council)\s*[:,\-–—]?\s*/i, "")
    .trim();
}

export async function deliberate(
  decision: string,
  opts?: { maxSeats?: number; routing?: { primary: string; secondaries: string[] } }
): Promise<DeliberationResult> {
  const maxSeats = opts?.maxSeats ?? DEFAULT_MAX_SEATS;
  const clean = (decision ?? "").trim();
  if (clean.length < 4) {
    return { ok: false, decision: clean, seats: [], synthesis: "", error: "no decision given to the council" };
  }

  // Convene: the routed lenses (primary + secondaries) become the seats. The chat
  // handler routes the stripped decision once and passes it in — no double route,
  // and the seats always match the operators the response reports.
  const routing = opts?.routing ?? (await routeOperatorsSemantic(clean));
  const seatOps = [routing.primary, ...routing.secondaries].filter((v, i, a) => a.indexOf(v) === i).slice(0, maxSeats);

  // Hear each lens fully — each reasons as PRIMARY, so buildSystemPrompt loads its
  // own confirmed heuristics + field synthesis. Sequential (bounded cost).
  const seats: Seat[] = [];
  for (const op of seatOps) {
    const seatPrompt =
      `Cole faces this decision:\n"${clean}"\n\n` +
      `Reason STRICTLY through the ${op} lens — its frameworks and principles only, applied to his specifics. ` +
      `In 2–4 sentences give: your recommendation, and the single most important consideration your lens raises ` +
      `that other perspectives might miss. Be concrete, not generic. Do not hedge into "it depends".`;
    try {
      const r = await runLLM({ taskType: "council_seat", operators: { primary: op, secondaries: [] }, input: seatPrompt });
      const take = (r?.text ?? "").trim();
      if (take && !engineUnavailableText(take)) seats.push({ operator: op, take });
    } catch (err) {
      console.warn(`[council] seat ${op} failed:`, (err as any)?.message ?? err);
    }
  }

  if (seats.length === 0) {
    return { ok: false, decision: clean, seats: [], synthesis: "", error: "the council could not convene (no LLM engine?)" };
  }

  // ── Rebuttal round ── each seat sees the others' openings and gets ONE shot:
  // concede what's right, attack what's wrong, state a final position. This is
  // what makes it a dialectic instead of parallel monologues — synthesis then
  // resolves positions that already survived contact, not first impressions.
  // A failed rebuttal is non-fatal: the seat's opening take stands as its final.
  if (seats.length >= 2) {
    for (const seat of seats) {
      const others = seats
        .filter((s) => s.operator !== seat.operator)
        .map((s) => `${s.operator.toUpperCase()}:\n${s.take}`)
        .join("\n\n");
      const rebuttalPrompt =
        `Cole's decision: "${clean}"\n\n` +
        `You argued, through the ${seat.operator} lens:\n"${seat.take}"\n\n` +
        `The other lenses argued:\n${others}\n\n` +
        `One round of rebuttal, 2–4 sentences: CONCEDE the strongest point against your position if it's right, ` +
        `ATTACK what's wrong in the others' reasoning as it applies to THIS decision, and state your FINAL ` +
        `recommendation (hold or update — updating under a better argument is strength, not weakness). ` +
        `No diplomacy, no restating your opening.`;
      try {
        const r = await runLLM({ taskType: "council_rebuttal", operators: { primary: seat.operator, secondaries: [] }, input: rebuttalPrompt });
        const reb = (r?.text ?? "").trim();
        if (reb && !engineUnavailableText(reb)) seat.rebuttal = reb;
      } catch (err) {
        console.warn(`[council] rebuttal ${seat.operator} failed (opening take stands):`, (err as any)?.message ?? err);
      }
    }
  }

  // Resolve in one voice — name agreement, name the real tension, decide.
  const seatsBlock = seats
    .map((s) => `${s.operator.toUpperCase()} (opening):\n${s.take}` + (s.rebuttal ? `\n${s.operator.toUpperCase()} (final, after rebuttal):\n${s.rebuttal}` : ""))
    .join("\n\n");
  const synthPrompt =
    `${seats.length} lenses weighed Cole's decision, then cross-examined each other:\n"${clean}"\n\n${seatsBlock}\n\n` +
    `Now speak in ONE voice (yours, Aurelius). Do NOT restate each lens in turn. Instead:\n` +
    `1. Where do the lenses AGREE — including ground ceded in rebuttal? (the settled ground)\n` +
    `2. Where is the real TENSION that SURVIVED the rebuttal for THIS decision? Name it sharply — don't smooth it into mush.\n` +
    `3. Given the tradeoffs, what's the call? Decide, concretely, and say what would change your mind.\n` +
    `Weight FINAL positions over openings — a lens that updated under a better argument earned that update.\n` +
    `Be direct and useful to Cole. The disagreement is the point — surface it, then resolve it.`;

  let synthesis = "";
  try {
    const r = await runLLM({ taskType: "council_synthesis", operators: { primary: routing.primary, secondaries: routing.secondaries }, input: synthPrompt });
    synthesis = (r?.text ?? "").trim();
  } catch (err) {
    console.warn("[council] synthesis failed:", (err as any)?.message ?? err);
  }
  if (!synthesis || engineUnavailableText(synthesis)) {
    return { ok: false, decision: clean, seats, synthesis: "", error: "the council heard the seats but couldn't synthesize (no engine?)" };
  }

  return { ok: true, decision: clean, seats, synthesis };
}

/** Format a deliberation into a chat reply that shows the minds arguing, then the call. */
export function formatDeliberation(result: DeliberationResult): string {
  if (!result.ok) return result.error ? `The council couldn't sit: ${result.error}` : "The council couldn't sit.";
  const seatLines = result.seats
    .map((s) => {
      const name = `${s.operator[0].toUpperCase()}${s.operator.slice(1)}`;
      return `**${name}**\n${s.take}` + (s.rebuttal ? `\n\n↩ *${name}, after hearing the others:*\n${s.rebuttal}` : "");
    })
    .join("\n\n");
  return `🏛️ **The council on:** ${result.decision}\n\n${seatLines}\n\n— — —\n\n${result.synthesis}`;
}
