// aurelius/planning/sessionPrep.ts
//
// PRE-SESSION RECALL — the pre-flight council's "gap nobody named." The
// calendar knows "4pm — Sarah"; the Brain knows about Sarah's knee, her PR
// attempt, what she said about sleep — and nothing joined them before Cole
// walked to the rack. This is the join: for each person-shaped event on the
// day, recall what the brain actually holds and hand the briefing one line
// per session. SILENT when the brain has nothing (calm beats filler) — the
// surface exists so every voice note Cole captures has somewhere to land
// the next time that athlete is on the calendar.

import { semanticRecall } from "../retrieval/retrieve.ts";

// System blocks and self-facing entries are never "sessions."
const NOT_A_SESSION = /deep work|protected|focus|briefing|debrief|planning|hold|blocked|lunch|travel/i;

export type PrepEvent = { title: string; startAt: Date | string };
export type SessionPrep = { time: string; title: string; note: string };

export function localClock(d: Date): string {
  try {
    return d.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: process.env.AURELIUS_TZ?.trim() || undefined,
    });
  } catch {
    return d.toISOString().slice(11, 16);
  }
}

/** Events on the day worth prepping — the person-shaped ones. */
export function prepCandidates(events: PrepEvent[]): PrepEvent[] {
  return events.filter((e) => e.title && !NOT_A_SESSION.test(e.title)).slice(0, 8);
}

/**
 * One recall per candidate event, one line per hit. Recall failure or an
 * empty brain both mean "no line" — this must never make the briefing
 * louder than the knowledge behind it.
 */
export async function sessionPrepForEvents(events: PrepEvent[]): Promise<SessionPrep[]> {
  const out: SessionPrep[] = [];
  for (const e of prepCandidates(events)) {
    try {
      const hits = await semanticRecall({ query: e.title, limit: 2 });
      if (hits.length === 0) continue;
      const note = hits[0]!.chunkText.replace(/\s+/g, " ").trim().slice(0, 140);
      if (!note) continue;
      out.push({ time: localClock(new Date(e.startAt)), title: e.title, note });
    } catch {
      // recall is a bonus, never a blocker
    }
  }
  return out;
}

/** The briefing footer — deterministic, appended AFTER the voice pass so
 *  the LLM's 180-word budget can't compress the prep away. */
export function formatSessionPrep(prep: SessionPrep[]): string {
  if (prep.length === 0) return "";
  return [
    "",
    "— Session prep (what the brain remembers) —",
    ...prep.map((p) => `❈ ${p.time} ${p.title} — ${p.note}`),
  ].join("\n");
}
