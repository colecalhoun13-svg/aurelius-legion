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
import { getActionFinalizer, getActionInverse, hasActionInverse } from "./actionRegistry.ts";

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
    // If this action has a registered inverse, attach a one-tap Undo carrying
    // what undo needs (the payload + the finalizer's result). The actionClass is
    // recorded on every executed signal so the trust ledger can attribute it.
    const undoable = hasActionInverse(args.actionClass);
    const actions: any[] = [{ action: "executed", actionClass: args.actionClass }];
    if (undoable) {
      actions.push({
        label: "Undo",
        action: "undo_action",
        payload: { actionClass: args.actionClass, actionPayload: prepared.payload ?? null, result: result ?? null },
      });
    }
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
          `\n\n_Done on its own under grant \`${args.actionClass}\`.${undoable ? " Tap Undo (or say “undo that”) and I'll reverse it." : " Reversible — tell me if this was wrong."}_`,
        actions,
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
  // The phone Bridge: every ask reaches Cole's thumb with Confirm/Dismiss
  // buttons (Cole's directive — the web Bridge alone starves the loop).
  // Fire-and-forget; dormant-safe without a Telegram token.
  import("../telegram/bot.ts")
    .then((m) => m.pushBridgeAsk({ id: sig.id, title: sig.title, body: sig.body, status: sig.status, actions: sig.actions }))
    .catch(() => {});
  return { finalized: false, reason: gateReason, bridgeSignalId: sig.id };
}

/**
 * Boot reaper. confirmAction claims a row (pending → acting) before finalizing.
 * If the process dies mid-finalize, that row is stranded in "acting". At BOOT no
 * confirm is in flight, so we recover stranded rows — BUT the recovery differs by
 * tier, because a crash can land AFTER the outward API call succeeded but BEFORE
 * the "acted" write:
 *   • INWARD → safe to release to "pending" (reversible/idempotent; re-running a
 *     schedule hold or a mission re-check does no harm).
 *   • OUTWARD (publish/send/spend) → NEVER silently re-arm — it may have already
 *     shipped, and a re-confirm would double-publish. Surface it to Cole as a
 *     "surfaced" signal with a warning so he decides, rather than auto-re-arming.
 */
export async function reapStaleActing(): Promise<number> {
  try {
    const stranded = await prisma.bridgeSignal.findMany({ where: { status: "acting" } });
    if (stranded.length === 0) return 0;

    const { getActionClass } = await import("./actionClasses.ts");
    let inward = 0;
    let outward = 0;
    for (const sig of stranded) {
      const actions = (sig.actions as any[]) ?? [];
      const confirm = actions.find((a) => a?.action === "confirm_action");
      const actionClass = confirm?.payload?.actionClass ?? "";
      // The apply_grant confirm wraps a to-be-granted class in its payload, but the
      // action itself (autonomy.apply_grant) is inward-safe to re-arm. Judge the
      // confirm's OWN class tier. An UNKNOWN class on an executable confirm is
      // treated as OUTWARD: a class this build can't identify may already have
      // shipped, and silently re-arming it is the double-fire this reaper exists
      // to prevent. Only a signal with no confirm_action at all (nothing to
      // finalize) is safe to release back to pending.
      const tier = getActionClass(actionClass)?.tier ?? (confirm ? "outward" : "inward");
      if (tier === "outward") {
        await prisma.bridgeSignal.update({
          where: { id: sig.id },
          data: {
            status: "surfaced",
            severity: "critical",
            body:
              sig.body +
              `\n\n⚠️ A restart interrupted this WHILE it was executing. It may have already gone out. Verify before re-confirming — I won't re-run it on my own.`,
          },
        });
        outward++;
      } else {
        await prisma.bridgeSignal.update({ where: { id: sig.id }, data: { status: "pending" } });
        inward++;
      }
    }
    console.log(`[executor] reaped stranded 'acting': ${inward} inward → pending, ${outward} outward → surfaced for review`);
    return inward + outward;
  } catch (err) {
    console.warn("[executor] reapStaleActing failed:", (err as any)?.message ?? err);
    return 0;
  }
}

/**
 * Cole confirmed a gated proposal on the Bridge → commit it now. This is Cole's
 * explicit authority, so it runs the finalizer regardless of grant state (it's
 * how OUTWARD actions ship too: prepared → gated → Cole confirms → executes).
 *
 * Idempotent AND concurrency-safe: confirm is the gate protecting IRREVERSIBLE
 * outward actions, so a double-click (or a Bridge tap racing a retry) must never
 * run the finalizer twice. We atomically CLAIM the row (pending → acting) with a
 * conditional updateMany before finalizing — only the caller whose update
 * changed a row proceeds; the loser is a no-op success. On finalizer failure we
 * release the claim back to pending so Cole can retry.
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

  // Atomic claim: flip → acting only from a genuinely confirmable state. This is
  // a WHITELIST, not a blacklist: only "pending" (the normal gate) and "surfaced"
  // (the reaper's outward-review state) may be confirmed. A blacklist of
  // ["acting","acted"] would let a DISMISSED or UNDONE proposal be confirmed by a
  // later /confirm (a stale tab, a retry) — re-shipping an outward publish Cole
  // rejected, or resurrecting a hold he undid. "Dismiss" and "Undo" must mean no.
  // The DB serializes concurrent updateManys; exactly one gets count === 1.
  const claim = await prisma.bridgeSignal.updateMany({
    where: { id: sig.id, status: { in: ["pending", "surfaced"] } },
    data: { status: "acting" },
  });
  if (claim.count === 0) {
    // Not in a confirmable state (already claimed/acted, or dismissed/undone) —
    // don't run the finalizer.
    return { ok: true, result: "not confirmable (already handled or withdrawn)" };
  }

  try {
    const result = await runTraced(
      "action",
      `confirm:${actionClass}`,
      () => finalizer(confirm.payload.actionPayload),
      { confirmedBy: "cole" }
    );
    // Attach a one-tap Undo if this class has a registered inverse (keep the
    // original confirm action for the record).
    const nextActions: any[] = [...actions];
    if (hasActionInverse(actionClass)) {
      nextActions.push({
        label: "Undo",
        action: "undo_action",
        payload: { actionClass, actionPayload: confirm.payload.actionPayload ?? null, result: result ?? null },
      });
    }
    await prisma.bridgeSignal.update({ where: { id: sig.id }, data: { status: "acted", actions: nextActions } });
    return { ok: true, result };
  } catch (err: any) {
    // Release the claim so Cole can retry — the outward action did NOT ship.
    await prisma.bridgeSignal
      .updateMany({ where: { id: sig.id, status: "acting" }, data: { status: "pending" } })
      .catch(() => {});
    return { ok: false, error: err?.message ?? "finalize failed" };
  }
}

/**
 * Reverse an executed action — the real "I'll undo it" (master-class #4). Runs
 * the registered inverse with the original payload + the finalizer's result, then
 * marks the signal "undone". Atomic claim (acted → undoing → undone) so a
 * double-tap can't run the inverse twice.
 */
export async function undoAction(bridgeSignalId: string): Promise<{ ok: boolean; result?: any; error?: string }> {
  const sig = await prisma.bridgeSignal.findUnique({ where: { id: bridgeSignalId } });
  if (!sig) return { ok: false, error: "signal not found" };
  if (sig.status === "undone") return { ok: true, result: "already undone" };
  if (sig.status !== "acted") return { ok: false, error: `can only undo an executed action (this one is ${sig.status})` };

  const actions = (sig.actions as any[]) ?? [];
  const undo = actions.find((a) => a?.action === "undo_action");
  const actionClass = undo?.payload?.actionClass;
  if (!undo || !actionClass) return { ok: false, error: "this action has no undo" };

  const inverse = getActionInverse(actionClass);
  if (!inverse) return { ok: false, error: `no inverse registered for ${actionClass}` };

  // Atomic claim: acted → undoing (only one caller wins).
  const claim = await prisma.bridgeSignal.updateMany({
    where: { id: sig.id, status: "acted" },
    data: { status: "undoing" },
  });
  if (claim.count === 0) return { ok: true, result: "already undoing/undone" };

  try {
    const result = await runTraced(
      "action",
      `undo:${actionClass}`,
      () => inverse(undo.payload.actionPayload, undo.payload.result),
      { undoneBy: "cole" }
    );
    await prisma.bridgeSignal.update({
      where: { id: sig.id },
      data: { status: "undone", body: sig.body + `\n\n_Undone._` },
    });
    return { ok: true, result };
  } catch (err: any) {
    await prisma.bridgeSignal
      .updateMany({ where: { id: sig.id, status: "undoing" }, data: { status: "acted" } })
      .catch(() => {});
    return { ok: false, error: err?.message ?? "undo failed" };
  }
}
