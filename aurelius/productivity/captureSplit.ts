// aurelius/productivity/captureSplit.ts
//
// THE BRAIN-DUMP SPLITTER — one message, many filings. Cole's captures arrive
// as dumps ("invoice Sarah, Jake's knee felt better, idea: post about tempo
// runs, $30 chalk"), and filing the whole thing as one note buries three of
// the four. splitCapture classifies each clause and files it where it lives:
//
//   task         → Task (inbox — Cole triages)
//   lead         → warm-list lead (crm/leadEngine.importWarmList — deduped,
//                  first-message follow-up due; INWARD, nothing contacted)
//   athlete_note → memory (training operator, category "clients") so the next
//                  session prep for that athlete recalls it
//   content_idea → note + a "write: …" task (never a fabricated draft)
//   expense      → business/expenses.addExpense (falls back to a note if the
//                  expense ledger can't take it — never lost)
//   note         → quickCapture (the old behavior)
//
// HONEST FAILURE: with no engine (or an unparseable answer) the WHOLE text
// files as one note — exactly the pre-splitter behavior. A capture is never
// lost and error text is never filed (engineUnavailableText guard).
//
// Invokers (rule 8): telegram/bot.ts free-text path (2+ clause heuristic —
// single thoughts keep the chat pipeline). The Home capture box posts to
// /api/today/actions, which is outside this wave's ownership — web capture
// keeps its current single-filing path for now.

import { runLLM } from "../llm/runLLM.ts";
import { engineUnavailableText } from "../llm/nonAnswer.ts";
import { createTask, quickCapture } from "./service.ts";

export type CaptureKind = "task" | "lead" | "athlete_note" | "content_idea" | "expense" | "note";

export type CaptureReceipt = { kind: CaptureKind; line: string };

export type SplitResult = {
  /** false = the splitter stood down (no engine / nothing to split) and the
   *  text was filed whole as one note — the honest fallback, never a loss. */
  split: boolean;
  receipts: CaptureReceipt[];
};

/**
 * Conservative "is this a brain dump?" gate for callers (the Telegram bridge).
 * True only for 2+ newline/semicolon-separated clauses, or 3+ comma-separated
 * clauses of three-plus words — a single thought, a question, or a command
 * stays on the normal chat path. Deliberately strict: mis-routing a real
 * question into the splitter is worse than filing a dump as one note.
 */
export function looksLikeBrainDump(text: string): boolean {
  const t = (text ?? "").trim();
  if (t.length < 20) return false;
  if (t.includes("?")) return false; // questions go to the chat pipeline
  if (t.startsWith("/")) return false; // commands are commands
  const lines = t.split(/[\n;]+/).map((s) => s.trim()).filter((s) => s.split(/\s+/).length >= 2);
  if (lines.length >= 2) return true;
  const clauses = t.split(",").map((s) => s.trim()).filter((s) => s.split(/\s+/).length >= 3);
  return clauses.length >= 3;
}

type ClassifiedItem = { kind: CaptureKind; payload: any };

const KINDS: readonly CaptureKind[] = ["task", "lead", "athlete_note", "content_idea", "expense", "note"];

async function classify(text: string): Promise<ClassifiedItem[] | null> {
  const response = await runLLM({
    taskType: "chat",
    operators: { primary: "strategy", secondaries: [] },
    noReuse: true, // near-identical dumps must never replay a prior split
    omitToolCatalog: true, // pure classification
    input: [
      `Split Cole's capture below into separate items and classify each. Kinds:`,
      `  task         — something to do: {"title":"...","due":"YYYY-MM-DD"|null}`,
      `  lead         — a person who might become a coaching client: {"name":"...","context":"how Cole knows them / why now"|null}`,
      `  athlete_note — an observation about a named athlete/client: {"name":"...","note":"..."}`,
      `  content_idea — an idea for a post/content: {"idea":"..."}`,
      `  expense      — money spent: {"amount":14.99,"note":"what for","category":"software|equipment|education|marketing|fees|other"|null}`,
      `  note         — anything else worth keeping: {"content":"..."}`,
      `Rules: keep Cole's own words; never invent items, names, amounts or dates; when unsure, use "note".`,
      `Answer with ONLY a JSON array (no prose, no code fence): [{"kind":"...","payload":{...}}, ...]`,
      ``,
      `CAPTURE:`,
      text.slice(0, 3000),
    ].join("\n"),
  });
  if (engineUnavailableText(response.text ?? "")) return null; // no engine → caller falls back whole
  const match = (response.text ?? "").match(/\[[\s\S]*\]/);
  if (!match) return null;
  let raw: any;
  try {
    raw = JSON.parse(match[0]);
  } catch {
    return null;
  }
  if (!Array.isArray(raw)) return null;
  const items: ClassifiedItem[] = [];
  for (const it of raw.slice(0, 12)) {
    const kind = KINDS.includes(it?.kind) ? (it.kind as CaptureKind) : "note";
    if (!it?.payload || typeof it.payload !== "object") continue;
    items.push({ kind, payload: it.payload });
  }
  return items.length > 0 ? items : null;
}

/** The one-note fallback — current behavior, so a capture is NEVER lost. */
async function fileWhole(text: string, captureContext: string): Promise<SplitResult> {
  await quickCapture({ content: text, captureContext });
  return { split: false, receipts: [{ kind: "note", line: "Captured to your inbox." }] };
}

/**
 * Classify and file a brain dump. Every branch that fails degrades to a note
 * for THAT item (receipt says so); a dead engine degrades to one note for the
 * whole text. Receipts are verb-first, ready to echo back to Cole.
 */
export async function splitCapture(
  text: string,
  opts: { captureContext?: string } = {}
): Promise<SplitResult> {
  const captureContext = opts.captureContext ?? "brain_dump";
  const body = (text ?? "").trim();
  if (!body) return { split: false, receipts: [] };

  let items: ClassifiedItem[] | null = null;
  try {
    items = await classify(body);
  } catch (err) {
    console.warn("[captureSplit] classify failed — filing whole as one note:", (err as any)?.message ?? err);
  }
  if (!items) return fileWhole(body, captureContext);

  const receipts: CaptureReceipt[] = [];
  const noteFallback = async (kind: CaptureKind, content: string, why: string) => {
    await quickCapture({ content, captureContext });
    receipts.push({ kind, line: `Noted — "${content.slice(0, 60)}" (${why}).` });
  };

  for (const item of items) {
    const p = item.payload ?? {};
    try {
      switch (item.kind) {
        case "task": {
          const title = String(p.title ?? "").trim();
          if (!title) break;
          const due = typeof p.due === "string" && !Number.isNaN(new Date(p.due).getTime()) ? new Date(p.due).toISOString() : undefined;
          await createTask({
            title,
            dueDate: due,
            status: "inbox",
            origin: "cole",
            originContext: { source: "capture_split", captureContext },
          });
          receipts.push({ kind: "task", line: `Filed task — "${title}"${due ? ` (due ${due.slice(0, 10)})` : ""}.` });
          break;
        }
        case "lead": {
          const name = String(p.name ?? "").trim();
          if (!name) break;
          const { importWarmList } = await import("../crm/leadEngine.ts");
          const r = await importWarmList([{ name, context: p.context ? String(p.context) : undefined }]);
          receipts.push({
            kind: "lead",
            line:
              r.created > 0
                ? `Added lead — ${name} (warm list, first message due).`
                : `Lead already on the list — ${name}, nothing duplicated.`,
          });
          break;
        }
        case "athlete_note": {
          const name = String(p.name ?? "").trim();
          const note = String(p.note ?? "").trim();
          if (!name || !note) break;
          const { saveMemory } = await import("../memory/memoryService.ts");
          const saved = await saveMemory({
            operator: "training",
            category: "clients",
            value: `${name}: ${note}`,
            metadata: { athlete: name, source: "capture_split" },
          });
          if (!saved) {
            await noteFallback("athlete_note", `${name}: ${note}`, "memory unavailable — kept as a note");
            break;
          }
          receipts.push({ kind: "athlete_note", line: `Remembered about ${name} — "${note.slice(0, 60)}" (surfaces at the next session prep).` });
          break;
        }
        case "content_idea": {
          const idea = String(p.idea ?? "").trim();
          if (!idea) break;
          // A note (the idea, verbatim) + a "write:" task. NEVER a fabricated
          // draft — drafting is a deliberate act with its own gated lane.
          await quickCapture({ content: idea, title: "Content idea", captureContext });
          await createTask({
            title: `write: ${idea.slice(0, 90)}`,
            status: "inbox",
            origin: "cole",
            originContext: { source: "capture_split", kind: "content_idea" },
          });
          receipts.push({ kind: "content_idea", line: `Kept content idea — "${idea.slice(0, 60)}" (+ a "write:" task in the inbox).` });
          break;
        }
        case "expense": {
          const note = p.note ? String(p.note) : undefined;
          try {
            const { addExpense } = await import("../business/expenses.ts");
            const e = await addExpense({
              amount: p.amount,
              note,
              category: p.category ? String(p.category) : undefined,
              source: "capture",
            });
            receipts.push({ kind: "expense", line: `Logged expense — $${(e.amountCents / 100).toFixed(2)}${note ? ` (${note.slice(0, 40)})` : ""}.` });
          } catch (err) {
            // Bad amount/category or ledger unavailable — keep the words.
            await noteFallback(
              "expense",
              `Expense: ${[p.amount, note].filter(Boolean).join(" — ")}`,
              `couldn't log it: ${((err as any)?.message ?? "expense ledger unavailable").slice(0, 80)}`
            );
          }
          break;
        }
        case "note":
        default: {
          const content = String(p.content ?? "").trim();
          if (!content) break;
          await quickCapture({ content, captureContext });
          receipts.push({ kind: "note", line: `Noted — "${content.slice(0, 60)}".` });
          break;
        }
      }
    } catch (err) {
      // No item is ever lost to a filing failure — it becomes a note.
      const fallbackText = JSON.stringify(p).slice(0, 300);
      try {
        await noteFallback(item.kind, fallbackText, `filing failed: ${((err as any)?.message ?? err).toString().slice(0, 60)}`);
      } catch {
        console.error("[captureSplit] even the note fallback failed — item dropped:", fallbackText);
      }
    }
  }

  if (receipts.length === 0) return fileWhole(body, captureContext);
  return { split: true, receipts };
}
