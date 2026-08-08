// aurelius/productivity/promises.ts
//
// THE PROMISE LEDGER — the smallest unit of trust. "I told Mara I'd send the
// quote Friday" and "Jake said he'd send his training log" are the two halves
// of the same table: what Cole owes people (owed_by_cole) and what people owe
// him (waiting_on). A promise that slips silently costs more than a task that
// slips — the counterpart remembers.
//
// Honest by construction:
//   • Extraction only ever reads what Cole actually said/sent — it never
//     invents a commitment, and with no engine it returns [] (never error
//     text filed as a promise; hard rule 3 via engineUnavailableText).
//   • "Lapsed" is computed by the sweep from dueAt, never guessed.
//   • Everything here is INWARD — a ledger row, reversible (kept/dropped),
//     nothing sent to any counterpart.
//
// Invokers (CLAUDE.md rule 8 — done is reachable):
//   • productivity tool adapter: `promise` (file) + `promises` (list/resolve)
//   • morning briefing (rituals/engine.ts): lapseSweep + due-today/lapsed block
//   • frontend/app/api/promises (GET list + POST resolve/add)
//   • Home page "Ledger of promises" section (renders only when non-empty)

import { prisma } from "../core/db/prisma.ts";
import { runLLM } from "../llm/runLLM.ts";
import { engineUnavailableText } from "../llm/nonAnswer.ts";
import { operatorToday } from "../core/time.ts";

export type PromiseDirection = "owed_by_cole" | "waiting_on";
export const PROMISE_DIRECTIONS: readonly PromiseDirection[] = ["owed_by_cole", "waiting_on"];

export type AddPromiseInput = {
  direction: PromiseDirection;
  counterpart: string;
  text: string;
  dueAt?: string | Date | null;
  sourceType?: string; // "chat" | "telegram" | "cole" | "gmail_sent"
  sourceId?: string;
};

function parseDue(v: string | Date | null | undefined): Date | null {
  if (v === undefined || v === null || v === "") return null;
  const d = v instanceof Date ? v : new Date(String(v));
  // Same sanity window as the task adapter: "Friday" → Invalid Date, "07/18"
  // → the year 2001. Refuse both rather than filing a lie.
  if (Number.isNaN(d.getTime()) || d.getFullYear() < 2020 || d.getFullYear() > 2100) return null;
  return d;
}

export async function addPromise(input: AddPromiseInput) {
  const counterpart = (input.counterpart ?? "").trim();
  const text = (input.text ?? "").trim();
  if (!counterpart) throw new Error("A promise needs a counterpart (who it involves).");
  if (!text) throw new Error("A promise needs its text (what was committed).");
  const direction: PromiseDirection = PROMISE_DIRECTIONS.includes(input.direction)
    ? input.direction
    : "owed_by_cole";
  return prisma.promise.create({
    data: {
      direction,
      counterpart: counterpart.slice(0, 120),
      text: text.slice(0, 500),
      dueAt: parseDue(input.dueAt),
      sourceType: (input.sourceType ?? "chat").slice(0, 40),
      sourceId: input.sourceId ?? null,
    },
  });
}

/** Rule on a promise. Only open/lapsed rows are resolvable — a second tap on
 *  an already-kept promise is a safe no-op (returns null). */
export async function resolvePromise(id: string, status: "kept" | "dropped") {
  if (status !== "kept" && status !== "dropped") {
    throw new Error(`a promise resolves to "kept" or "dropped", not "${status}"`);
  }
  const updated = await prisma.promise.updateMany({
    where: { id, status: { in: ["open", "lapsed"] } },
    data: { status, resolvedAt: new Date() },
  });
  if (updated.count === 0) return null;
  return prisma.promise.findUnique({ where: { id } });
}

/** Everything still awaiting a ruling: open AND lapsed (a lapsed promise is
 *  MORE in need of Cole's eye, not less — it stays on the ledger until he
 *  rules kept or dropped). Due-first, undated last. */
export async function listOpenPromises(opts: { limit?: number } = {}) {
  const rows = await prisma.promise.findMany({
    where: { status: { in: ["open", "lapsed"] } },
    orderBy: [{ dueAt: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
    take: Math.min(opts.limit ?? 50, 200),
  });
  return rows;
}

/** Start of the operator-local day, as a Date. Promises due before this are
 *  past their whole due DAY, not merely past a midnight-UTC technicality. */
function startOfOperatorToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Mark open past-due promises lapsed. Deterministic, idempotent, cheap —
 *  invoked from the morning briefing and the promises GET route (rule 8:
 *  the sweep has named callers, not a hope). */
export async function lapseSweep(): Promise<number> {
  const res = await prisma.promise.updateMany({
    where: { status: "open", dueAt: { not: null, lt: startOfOperatorToday() } },
    data: { status: "lapsed" },
  });
  return res.count;
}

/** The operator-local YYYY-MM-DD a promise is due, or null. Exported so the
 *  briefing and the UI agree on what "due today" means. */
export function dueDayOf(dueAt: Date | null | undefined): string | null {
  if (!dueAt) return null;
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: process.env.AURELIUS_TZ?.trim() || undefined,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(dueAt);
  } catch {
    return dueAt.toISOString().slice(0, 10);
  }
}

// ── Extraction — only from what Cole actually said ───────────────────

export type ExtractedPromise = {
  direction: PromiseDirection;
  counterpart: string;
  text: string;
  due?: string | null; // ISO date when the text names one
};

/**
 * Pull explicit commitments out of a piece of text Cole wrote or sent.
 *
 * HONEST: returns [] when no engine is configured or the model errors
 * (engineUnavailableText — error text must never become a ledger row), and
 * [] when the text simply contains no commitment. Never throws into a caller.
 */
export async function extractPromisesFromText(
  text: string,
  source: string
): Promise<ExtractedPromise[]> {
  const input = (text ?? "").trim();
  if (!input) return [];
  try {
    const response = await runLLM({
      taskType: "chat",
      operators: { primary: "strategy", secondaries: [] },
      noReuse: true, // extraction over near-identical texts must never replay a stale answer
      omitToolCatalog: true, // pure classification — the ~21KB catalog buys nothing
      input: [
        `Extract EXPLICIT commitments from the text below, written by Cole (a coach).`,
        `Two kinds only:`,
        `  • owed_by_cole — Cole committed to do something for a named person ("I told Mara I'd send the quote Friday").`,
        `  • waiting_on — a named person committed something to Cole ("Jake said he'll send his training log").`,
        `Rules: only commitments actually stated in the text — never infer, never invent. "today" is ${operatorToday()}.`,
        `Answer with ONLY a JSON array (no prose, no code fence). Each item:`,
        `  {"direction":"owed_by_cole"|"waiting_on","counterpart":"<person>","text":"<the commitment, short>","due":"YYYY-MM-DD"|null}`,
        `If there are no explicit commitments, answer [].`,
        ``,
        `TEXT:`,
        input.slice(0, 4000),
      ].join("\n"),
    });
    if (engineUnavailableText(response.text ?? "")) return []; // honest empty, never error-as-content
    const match = (response.text ?? "").match(/\[[\s\S]*\]/);
    if (!match) return [];
    const raw = JSON.parse(match[0]);
    if (!Array.isArray(raw)) return [];
    const out: ExtractedPromise[] = [];
    for (const item of raw.slice(0, 8)) {
      const counterpart = String(item?.counterpart ?? "").trim();
      const ptext = String(item?.text ?? "").trim();
      const direction = item?.direction === "waiting_on" ? "waiting_on" : "owed_by_cole";
      if (!counterpart || !ptext) continue;
      const due = typeof item?.due === "string" && parseDue(item.due) ? item.due : null;
      out.push({ direction, counterpart, text: ptext, due });
    }
    return out;
  } catch (err) {
    console.warn(`[promises] extraction failed (nothing filed, ${source}):`, (err as any)?.message ?? err);
    return [];
  }
}
