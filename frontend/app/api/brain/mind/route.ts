import { NextResponse } from "next/server";
import { prisma } from "../../../../../aurelius/core/db/prisma";

// HOW I THINK — the compiled lens, surfaced. GET is read-only: the heuristics
// (confirmed + proposed CompiledPatterns) with their trust counters and how
// often each actually fired (tallied from the decision:patterns_fired audit
// trail — firing is logged, not a column), plus the active persona entries
// (scope "persona") that calibrate the voice.
//
// POST routes confirm/retire through the EXISTING executor gate. Both classes
// are neverGrant (actionClasses.ts) so executeAction always GATES them to a
// pending Bridge confirm — the button files the ask, only Cole's tap on
// Decisions fires the finalizer. That is the design, not a limitation: trust
// changes only by his explicit hand (CLAUDE.md hard rule 1).

export const dynamic = "force-dynamic";

const FIRED_MSG = "decision:patterns_fired";

function ruleText(sig: any): string {
  if (sig && typeof sig === "object" && typeof sig.recurringReasoningTheme === "string") {
    return sig.recurringReasoningTheme.trim();
  }
  return "";
}

function oneLine(v: any): string {
  if (typeof v === "string") return v;
  if (v == null) return "";
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

export async function GET() {
  try {
    const [patterns, personaRows, factCount, firedRows] = await Promise.all([
      prisma.compiledPattern.findMany({
        where: { status: { in: ["confirmed_heuristic", "proposed_heuristic"] }, patternType: "heuristic" },
        orderBy: [{ status: "asc" }, { confidenceScore: "desc" }], // confirmed_* sorts before proposed_*
        select: {
          id: true,
          domain: true,
          status: true,
          patternSignature: true,
          confidenceScore: true,
          supportCount: true,
          validatedCount: true,
          ratifiedCount: true,
          updatedAt: true,
        },
      }),
      prisma.knowledgeEntry.findMany({
        where: { scope: "persona", active: true },
        orderBy: { updatedAt: "desc" },
        select: { key: true, value: true, updatedAt: true },
      }),
      prisma.compiledPattern.count({ where: { status: "auto_factual" } }),
      // Fired counts live in the outcome loop's audit rows, not on the pattern.
      // Bounded recent-window tally — an honest "how often has this steered".
      prisma.logEntry.findMany({
        where: { message: FIRED_MSG },
        orderBy: { createdAt: "desc" },
        take: 2000,
        select: { context: true },
      }),
    ]);

    const fired = new Map<string, number>();
    for (const row of firedRows) {
      const ids = (row.context as any)?.patternIds;
      if (!Array.isArray(ids)) continue;
      for (const id of ids) {
        if (typeof id === "string") fired.set(id, (fired.get(id) ?? 0) + 1);
      }
    }

    return NextResponse.json({
      rules: patterns.map((p) => ({
        id: p.id,
        rule: ruleText(p.patternSignature) || "(a compiled rule with no rendered text)",
        domain: p.domain,
        status: p.status,
        trust: p.confidenceScore ?? 0,
        support: p.supportCount ?? 0,
        validated: p.validatedCount ?? 0,
        ratified: p.ratifiedCount ?? 0,
        fired: fired.get(p.id) ?? 0,
        updatedAt: p.updatedAt,
      })),
      persona: personaRows.map((e) => ({ key: e.key, value: oneLine(e.value), updatedAt: e.updatedAt })),
      factCount,
    });
  } catch (error: any) {
    console.error("Brain mind error:", error);
    return NextResponse.json({ error: error?.message ?? "Failed to load the lens" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { op, patternId } = body ?? {};
    if (!["confirm", "retire"].includes(op) || !patternId || typeof patternId !== "string") {
      return NextResponse.json({ error: "op (confirm|retire) + patternId required" }, { status: 400 });
    }

    const p = await prisma.compiledPattern.findUnique({ where: { id: patternId } });
    if (!p) return NextResponse.json({ error: "no such pattern" }, { status: 404 });
    if (p.status === "discarded") {
      return NextResponse.json({ error: "that rule is already retired" }, { status: 409 });
    }
    if (op === "confirm" && p.status === "confirmed_heuristic") {
      return NextResponse.json({ error: "that rule is already confirmed" }, { status: 409 });
    }

    const rule = (ruleText(p.patternSignature) || "a compiled rule").slice(0, 200);
    // Same (sourceType, sourceId) conventions as chatCompiler/outcomeLoop, so
    // surfaceSignal's dedup collapses this onto any already-pending ask for the
    // same pattern instead of filing a second confirm.
    const { executeAction } = await import("../../../../../aurelius/autonomy/executor");
    const result = await executeAction(
      op === "confirm"
        ? {
            actionClass: "pattern.confirm",
            sourceType: "heuristic_confirm",
            sourceId: `pattern:${p.id}`,
            prepare: async () => ({
              title: "Confirm a rule from the Brain shelf",
              body:
                `You asked, from the Brain shelf, to confirm:\n\n“${rule}”\n\n` +
                `Confirm and it starts grounding reasoning. Dismiss and it stays an observation, steering nothing.`,
              domain: "personal",
              payload: { patternId: p.id },
            }),
          }
        : {
            actionClass: "pattern.retire",
            sourceType: "heuristic_retire",
            sourceId: `pattern-retire:${p.id}`,
            prepare: async () => ({
              title: "Retire a rule from the Brain shelf",
              body:
                `You asked, from the Brain shelf, to retire:\n\n“${rule}”\n\n` +
                `Confirm and it stops loading — kept as an observation only. Dismiss and it stands.`,
              domain: "personal",
              payload: { patternId: p.id },
            }),
          }
    );

    // pattern.confirm / pattern.retire are neverGrant: executeAction always
    // gates, so finalized is false by construction. Say what actually happened.
    return NextResponse.json({
      ok: true,
      staged: true,
      finalized: result.finalized,
      bridgeSignalId: result.bridgeSignalId,
      message:
        op === "confirm"
          ? "Staged for your confirm on Decisions — the rule changes only on your tap."
          : "Retirement staged for your confirm on Decisions — the rule stands until your tap.",
    });
  } catch (error: any) {
    console.error("Brain mind action error:", error);
    return NextResponse.json({ error: error?.message ?? "Staging failed" }, { status: 500 });
  }
}
