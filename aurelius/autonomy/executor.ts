// aurelius/autonomy/executor.ts
//
// THE ACTION-WITH-REVIEW EXECUTOR — the one wrapper every acting workflow goes
// through (NORTH_STAR §2.5). Build it once; each domain's workflow becomes a
// call, not new code (the scope council's "the gate is the primitive").
//
// A workflow provides an action-class and a prepare() that stages the work
// (draft, compute, pick a slot) into a plain JSON payload. The COMMIT logic
// lives in the action registry, keyed by action-class, so it can run in two
// places from the same definition:
//   • FINALIZE now (granted inward)         → executeAction runs it immediately.
//   • CONFIRM later (Cole taps the Bridge)  → confirmAction runs it from the
//                                             stored payload, even after a restart.
//
// executeAction does exactly one of:
//   • FINALIZE (granted inward) → run the finalizer under a trace, file an
//                 *executed* BridgeSignal (status "acted") Cole can still veto.
//   • GATE (not granted, or outward by construction) → file a *pending*
//                 BridgeSignal carrying the prepared payload for Cole's confirm.
//
// prepare() always runs, so the loop is closed to its last reversible step —
// what reaches Cole is a mostly-done thing to approve, not homework.

import { prisma } from "../core/db/prisma.ts";
import { runTraced } from "../core/trace.ts";
import { decideAction } from "./grants.ts";
import { getActionFinalizer } from "./actionRegistry.ts";

export type PreparedAction = {
  title: string;
  body: string;
  domain?: string;
  payload?: any; // JSON — passed to the finalizer now or on confirm
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
  operatorId?: string | null;
  sourceType?: string;
  sourceId?: string;
}): Promise<ExecuteResult> {
  const prepared = await args.prepare();
  const decision = await decideAction(args.actionClass);
  const finalizer = getActionFinalizer(args.actionClass);

  if (decision.finalize && finalizer) {
    const result = await runTraced(
      "action",
      args.actionClass,
      () => finalizer(prepared.payload),
      { finalized: true }
    );
    const sig = await prisma.bridgeSignal.create({
      data: {
        kind: "background_result",
        operatorId: args.operatorId ?? null,
        domain: prepared.domain ?? null,
        sourceType: args.sourceType ?? "reasoning_output",
        sourceId: args.sourceId ?? null,
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

  // Gate to Cole: not granted, outward by construction, or no finalizer yet.
  // Stash the payload so confirmAction() can commit it later from the Bridge.
  const gateReason = decision.finalize ? "no finalizer registered for this action" : decision.reason;
  const sig = await prisma.bridgeSignal.create({
    data: {
      kind: "background_result",
      operatorId: args.operatorId ?? null,
      domain: prepared.domain ?? null,
      sourceType: args.sourceType ?? "reasoning_output",
      sourceId: args.sourceId ?? null,
      severity: "attention",
      status: "pending",
      title: prepared.title,
      body: prepared.body + `\n\n_Prepared, not executed — ${gateReason}. Confirm to proceed._`,
      actions: [
        {
          label: "Confirm",
          action: "confirm_action",
          payload: { actionClass: args.actionClass, actionPayload: prepared.payload ?? null },
        },
        { label: "Dismiss", action: "dismiss", payload: {} },
      ],
    },
  });
  return { finalized: false, reason: gateReason, bridgeSignalId: sig.id };
}

/**
 * Cole confirmed a gated proposal on the Bridge → commit it now. This is Cole's
 * explicit authority, so it runs the finalizer regardless of grant state (it's
 * how OUTWARD actions ship too: prepared → gated → Cole confirms → executes).
 * Idempotent: an already-acted signal is a no-op success.
 */
export async function confirmAction(
  bridgeSignalId: string
): Promise<{ ok: boolean; result?: any; error?: string }> {
  const sig = await prisma.bridgeSignal.findUnique({ where: { id: bridgeSignalId } });
  if (!sig) return { ok: false, error: "signal not found" };
  if (sig.status === "acted") return { ok: true, result: "already acted" };

  const actions = (sig.actions as any[]) ?? [];
  const confirm = actions.find((a) => a?.action === "confirm_action");
  const actionClass = confirm?.payload?.actionClass;
  if (!actionClass) return { ok: false, error: "this signal has no confirmable action" };

  const finalizer = getActionFinalizer(actionClass);
  if (!finalizer) return { ok: false, error: `no finalizer registered for ${actionClass}` };

  try {
    const result = await runTraced(
      "action",
      `confirm:${actionClass}`,
      () => finalizer(confirm.payload.actionPayload),
      { confirmedBy: "cole" }
    );
    await prisma.bridgeSignal.update({ where: { id: sig.id }, data: { status: "acted" } });
    return { ok: true, result };
  } catch (err: any) {
    return { ok: false, error: err?.message ?? "finalize failed" };
  }
}
