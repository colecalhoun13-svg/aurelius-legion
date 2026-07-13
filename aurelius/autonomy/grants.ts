// aurelius/autonomy/grants.ts
//
// THE AUTONOMY GRANT STORE — the throttle that turns advising into operating
// (NORTH_STAR §2.5 / §6 Block 4). A grant is Cole handing Aurelius a scoped,
// reversible key to finalize one INWARD action-class on its own. Cole is the
// only writer; a grant is revocable with one call and then goes dormant,
// honestly, forever until re-granted.
//
// The safety is not in this store — it's in actionClasses.checkGrantable(),
// which refuses outward actions, training/health, and self-escalation by
// construction. grantAutonomy() will not write a row that check rejects, and
// isActionGranted() returns false for anything non-grantable even if a row
// somehow exists. Two locks, same key.
//
// Never embedded into the vector index — raw prisma only (hard rule 6).

import { prisma } from "../core/db/prisma.ts";
import { checkGrantable, getActionClass, type ActionClass } from "./actionClasses.ts";

export type Grant = {
  id: string;
  operator: string;
  actionClass: string;
  status: string;
  note: string | null;
  grantedAt: Date;
  revokedAt: Date | null;
};

/**
 * Cole grants Aurelius a scoped inward action-class. Refuses — loudly — any
 * class that isn't grantable (outward / unknown / training-health / autonomy).
 * Idempotent: re-granting a revoked class reactivates it.
 */
export async function grantAutonomy(args: {
  actionClass: string;
  note?: string;
  grantedBy?: string;
}): Promise<Grant> {
  const check = checkGrantable(args.actionClass);
  if (check.grantable) {
    const cls = check.actionClass;
    const grant = await prisma.autonomyGrant.upsert({
      where: { operator_actionClass: { operator: cls.operator, actionClass: cls.key } },
      update: {
        status: "active",
        revokedAt: null,
        note: args.note ?? null,
        grantedBy: args.grantedBy ?? "cole",
        grantedAt: new Date(),
      },
      create: {
        operator: cls.operator,
        actionClass: cls.key,
        status: "active",
        note: args.note ?? null,
        grantedBy: args.grantedBy ?? "cole",
      },
    });
    return grant as Grant;
  }
  throw new Error(`[autonomy] refused to grant "${args.actionClass}": ${check.reason}`);
}

/** Cole revokes a grant. Returns null if there was nothing to revoke. */
export async function revokeAutonomy(actionClass: string): Promise<Grant | null> {
  const cls = getActionClass(actionClass);
  if (!cls) return null;
  const existing = await prisma.autonomyGrant.findUnique({
    where: { operator_actionClass: { operator: cls.operator, actionClass: cls.key } },
  });
  if (!existing) return null;
  const revoked = await prisma.autonomyGrant.update({
    where: { id: existing.id },
    data: { status: "revoked", revokedAt: new Date() },
  });
  return revoked as Grant;
}

/**
 * THE GATE. Every action asks this before it finalizes. Returns true only for
 * a registered inward class with an active grant. Outward, unknown,
 * training/health, and autonomy classes return false ALWAYS — they are never
 * standing-granted; Cole confirms (or they never happen).
 */
export async function isActionGranted(actionClass: string): Promise<boolean> {
  const check = checkGrantable(actionClass);
  if (!check.grantable) return false;
  const cls = check.actionClass;
  const grant = await prisma.autonomyGrant.findUnique({
    where: { operator_actionClass: { operator: cls.operator, actionClass: cls.key } },
  });
  return grant?.status === "active";
}

/** All currently-active grants, most recent first. For the cockpit + /grants. */
export async function listActiveGrants(): Promise<Grant[]> {
  const rows = await prisma.autonomyGrant.findMany({
    where: { status: "active" },
    orderBy: { grantedAt: "desc" },
  });
  return rows as Grant[];
}

/**
 * The decision an action executor makes: given an action-class, may I finalize
 * it myself, or must I stop for Cole? Bundles the class metadata so callers can
 * explain the gate to Cole when the answer is "propose".
 */
export type ActionDecision = {
  finalize: boolean; // true = act now (granted inward); false = prepare + gate to Cole
  reason: string;
  actionClass?: ActionClass;
};

export async function decideAction(actionClass: string): Promise<ActionDecision> {
  const check = checkGrantable(actionClass);
  if (check.grantable) {
    const granted = await isActionGranted(actionClass);
    return granted
      ? { finalize: true, reason: `granted inward: ${check.actionClass.key}`, actionClass: check.actionClass }
      : {
          finalize: false,
          reason: `"${actionClass}" is grantable but not currently granted — prepare it and put it on the Bridge for Cole`,
          actionClass: check.actionClass,
        };
  }
  return { finalize: false, reason: check.reason, actionClass: getActionClass(actionClass) };
}
