// aurelius/autonomy/executor.ts
//
// THE ACTION-WITH-REVIEW EXECUTOR — the one wrapper every acting workflow goes
// through (NORTH_STAR §2.5). Build it once; each domain's workflow becomes a
// call, not new code (the scope council's "the gate is the primitive").
//
// Given an action-class plus two functions:
//   • prepare()  — produces the plan/artifact. ALWAYS safe and reversible: it
//                  drafts, computes, stages. It never commits anything outward.
//   • finalize() — commits the prepared action. Runs ONLY when the class is
//                  granted inward. Never runs for outward/ungranted classes.
//
// it asks decideAction() and does exactly one of:
//   • FINALIZE  (granted inward) → run finalize(), trace it, and file an
//                 *executed* BridgeSignal (status "acted") Cole can still veto.
//   • GATE       (not granted, or outward by construction) → file a *pending*
//                 BridgeSignal carrying the prepared plan for Cole's confirm.
//
// Because decideAction() refuses every outward class, finalize() is unreachable
// for publish/send/spend — this wrapper is safe around any action. And prepare()
// always runs, so the loop is closed to its last reversible step (the council's
// "finish to the edge, don't manufacture a firehose"): what reaches Cole is a
// mostly-done thing to approve, not homework.

import { prisma } from "../core/db/prisma.ts";
import { runTraced } from "../core/trace.ts";
import { decideAction } from "./grants.ts";

export type PreparedAction = {
  title: string; // short line — what this is
  body: string; // markdown — what would happen / what was done
  domain?: string;
  payload?: any; // machine-readable plan, for the finalize step or the UI
};

export type ExecuteResult = {
  finalized: boolean;
  reason: string;
  bridgeSignalId: string;
  result?: any;
};

export async function executeAction(args: {
  actionClass: string;
  prepare: () => Promise<PreparedAction>;
  finalize: (prepared: PreparedAction) => Promise<any>;
  operatorId?: string | null;
}): Promise<ExecuteResult> {
  // Always prepare — safe, reversible, no commitment. Closes the loop to the
  // edge whether or not we're allowed to take the last step.
  const prepared = await args.prepare();
  const decision = await decideAction(args.actionClass);

  if (decision.finalize) {
    const result = await runTraced(
      "action",
      args.actionClass,
      () => args.finalize(prepared),
      { finalized: true }
    );
    const sig = await prisma.bridgeSignal.create({
      data: {
        kind: "background_result",
        operatorId: args.operatorId ?? null,
        domain: prepared.domain ?? null,
        sourceType: "reasoning_output",
        severity: "info",
        status: "acted", // executed proposal — done, on the record, reversible
        title: prepared.title,
        body:
          prepared.body +
          `\n\n_Done on its own under grant \`${args.actionClass}\`. Reversible — tell me if this was wrong and I'll undo it._`,
      },
    });
    return { finalized: true, reason: decision.reason, bridgeSignalId: sig.id, result };
  }

  // Not granted (or outward by construction) — prepared, but Cole holds the key.
  const sig = await prisma.bridgeSignal.create({
    data: {
      kind: "background_result",
      operatorId: args.operatorId ?? null,
      domain: prepared.domain ?? null,
      sourceType: "reasoning_output",
      severity: "attention",
      status: "pending",
      title: prepared.title,
      body:
        prepared.body +
        `\n\n_Prepared, not executed — ${decision.reason}. Confirm to proceed._`,
      actions: [
        { label: "Confirm", action: "confirm_action", payload: { actionClass: args.actionClass } },
        { label: "Dismiss", action: "dismiss", payload: {} },
      ],
    },
  });
  return { finalized: false, reason: decision.reason, bridgeSignalId: sig.id };
}
