import { NextResponse } from "next/server";

// DB + grant side-effects — never statically evaluate at build time.
export const dynamic = "force-dynamic";

// GET → the autonomy dial: active grants, the grantable menu with each keyhole's
// trust track record, the "want me to just handle it?" suggestions, and the
// recent autonomous actions that can still be undone.
export async function GET() {
  try {
    const { listActiveGrants } = await import("../../../../../aurelius/autonomy/grants");
    const { listGrantableClasses } = await import("../../../../../aurelius/autonomy/actionClasses");
    const { getTrustLedger, suggestNextGrant } = await import("../../../../../aurelius/autonomy/trustLedger");
    const { prisma } = await import("../../../../../aurelius/core/db/prisma");

    const [active, ledger, suggestions] = await Promise.all([
      listActiveGrants(),
      getTrustLedger(),
      suggestNextGrant(),
    ]);
    const grantable = listGrantableClasses();
    const activeKeys = new Set(active.map((g: any) => g.actionClass));
    const ledgerBy = new Map(ledger.map((r: any) => [r.actionClass, r]));

    const classes = grantable.map((c: any) => {
      const l: any = ledgerBy.get(c.key);
      return {
        key: c.key,
        description: c.description,
        on: activeKeys.has(c.key),
        trackRecord: l ? { acted: l.acted, confirmed: l.confirmed, undone: l.undone, failed: l.failed } : null,
      };
    });

    // Recent autonomous actions that carry a one-tap Undo.
    const acted = await prisma.bridgeSignal.findMany({
      where: { status: "acted", createdAt: { gte: new Date(Date.now() - 7 * 24 * 3600 * 1000) } },
      orderBy: { createdAt: "desc" },
      take: 25,
    });
    const recentActions = acted
      .filter((s: any) => ((s.actions as any[]) ?? []).some((a) => a?.action === "undo_action"))
      .slice(0, 10)
      .map((s: any) => ({
        id: s.id,
        title: s.title,
        kind: s.kind,
        createdAt: s.createdAt,
        actionClass: ((s.actions as any[]) ?? []).find((a) => a?.action === "undo_action")?.payload?.actionClass ?? null,
      }));

    return NextResponse.json({
      active: active.map((g: any) => ({ actionClass: g.actionClass, grantedAt: g.grantedAt })),
      classes,
      suggestions,
      recentActions,
    });
  } catch (error: any) {
    console.error("Autonomy dial error:", error);
    return NextResponse.json({ error: error?.message ?? "failed to load autonomy dial" }, { status: 500 });
  }
}

// POST { op: "grant" | "revoke", actionClass } — Cole's own hand on the switch
// (a UI click is his explicit action, unlike the model-invoked tool which gates).
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const op = body?.op;
    const actionClass = body?.actionClass;
    if (!actionClass || typeof actionClass !== "string") {
      return NextResponse.json({ error: "actionClass is required" }, { status: 400 });
    }
    if (op === "grant") {
      const { grantAutonomy } = await import("../../../../../aurelius/autonomy/grants");
      try {
        const grant = await grantAutonomy({ actionClass, grantedBy: "cole", note: "granted from the Autonomy dial" });
        return NextResponse.json({ ok: true, grant });
      } catch (e: any) {
        // Non-grantable (outward/training/autonomy/unknown) → honest 400.
        return NextResponse.json({ ok: false, error: e?.message ?? "grant refused" }, { status: 400 });
      }
    }
    if (op === "revoke") {
      const { revokeAutonomy } = await import("../../../../../aurelius/autonomy/grants");
      const revoked = await revokeAutonomy(actionClass);
      return NextResponse.json({ ok: true, revoked: revoked !== null });
    }
    return NextResponse.json({ error: `unknown op "${op}"` }, { status: 400 });
  } catch (error: any) {
    console.error("Autonomy dial action error:", error);
    return NextResponse.json({ error: error?.message ?? "action failed" }, { status: 500 });
  }
}
