// aurelius/autonomy/actionClasses.ts
//
// THE ACTING TAXONOMY — NORTH_STAR §2.5 (Hybrid Autonomy) as data.
//
// An action-class is a named thing Aurelius can DO. Each is one of two tiers:
//   • inward  — Aurelius may FINALIZE it inside a Cole-granted keyhole
//               (schedule, organize, draft, ingest). Reversible, traced,
//               lands on the Bridge as an executed proposal.
//   • outward — publish / send / spend. NEVER grantable. Aurelius prepares it
//               to the edge and stops for Cole's confirm, every single time.
//
// Two more things are non-grantable by CONSTRUCTION, not by policy:
//   • training/health domains — signals only, Cole owns the call (hard rule 5).
//   • scope "autonomy" — autonomy never escalates its own autonomy (hard rule 1).
//
// This file is the single source of truth for grantability. The grant store
// (grants.ts) refuses anything checkGrantable() rejects, so a bad grant can't
// exist even if someone writes the row by hand.
//
// Design note (from the scope council): the acting layer must FINISH loops, not
// manufacture a firehose of drafts Cole has to adjudicate. Inward classes here
// are deliberately "prepare to the edge" — the value is a loop closed to the
// last reversible step, not volume produced.

export type ActionTier = "inward" | "outward";

export type ActionClass = {
  key: string; // stable id, e.g. "calendar.schedule_protection"
  operator: string; // the operator/domain it belongs to
  tier: ActionTier;
  domain?: string; // set to "training" | "health" to lock it out by domain
  description: string;
  gate: string; // where it stops for Cole (human-readable)
};

// Domains where Aurelius reports signals and never acts (hard rule 5).
export const NON_GRANTABLE_DOMAINS = new Set(["training", "health"]);

export const ACTION_CLASSES: ActionClass[] = [
  // ── Inward — grantable, one keyhole at a time ──────────────────────
  {
    key: "calendar.schedule_protection",
    operator: "scheduling",
    tier: "inward",
    description:
      "Defend deep-work and training blocks; reschedule around new conflicts on the calendar.",
    gate: "none — reversible calendar edits land on the Bridge as executed proposals Cole can veto",
  },
  {
    key: "research.ingest",
    operator: "research",
    tier: "inward",
    description:
      "Run the research missions the initiative pulse proposes and ingest their reports into the corpus.",
    gate: "none — inward corpus growth, fully traced",
  },
  {
    key: "inbox.triage_draft",
    operator: "gmail",
    tier: "inward",
    description:
      "Scan the inbox, classify what needs Cole, and draft replies into his Gmail drafts.",
    gate: "the send button — sending is the separate outward class email.send",
  },
  {
    key: "content.draft",
    operator: "content",
    tier: "inward",
    description:
      "Draft posts/newsletters from the corpus into a review queue, in Cole's voice.",
    gate: "publishing — the separate outward class content.publish",
  },
  {
    key: "systems.sop_draft",
    operator: "business",
    tier: "inward",
    description:
      "Draft SOPs and workflow docs into the Business OS living document.",
    gate: "propose→confirm before it becomes canonical",
  },

  // ── Outward — NEVER grantable, Cole confirms every instance ─────────
  {
    key: "email.send",
    operator: "gmail",
    tier: "outward",
    description: "Send an email.",
    gate: "always Cole's confirm",
  },
  {
    key: "content.publish",
    operator: "content",
    tier: "outward",
    description: "Publish content to a public surface.",
    gate: "always Cole's confirm",
  },
  {
    key: "outreach.send",
    operator: "business",
    tier: "outward",
    description: "Send outreach to a lead or client.",
    gate: "always Cole's confirm",
  },
  {
    key: "wealth.trade",
    operator: "wealth",
    tier: "outward",
    description: "Execute a trade or move money.",
    gate: "always Cole's confirm (spend)",
  },

  // ── Non-grantable by domain — signals only ─────────────────────────
  {
    key: "training.prescribe",
    operator: "training",
    tier: "inward", // inward-shaped, but the training domain locks it out
    domain: "training",
    description: "Write training prescriptions or programming.",
    gate: "NON-GRANTABLE — signals only; Cole makes the call (hard rule 5)",
  },
];

export function getActionClass(key: string): ActionClass | undefined {
  return ACTION_CLASSES.find((c) => c.key === key);
}

/** Every action-class, each tagged with whether Cole can grant it. For the surface. */
export function listAllActionClasses(): Array<ActionClass & { grantable: boolean; grantReason: string }> {
  return ACTION_CLASSES.map((c) => {
    const g = checkGrantable(c.key);
    return { ...c, grantable: g.grantable, grantReason: g.reason };
  });
}

/** Just the classes Cole is allowed to grant (inward, non-training/health). */
export function listGrantableClasses(): ActionClass[] {
  return ACTION_CLASSES.filter((c) => checkGrantable(c.key).grantable);
}

export type Grantability =
  | { grantable: true; reason: string; actionClass: ActionClass }
  | { grantable: false; reason: string };

/**
 * The one gate. Returns grantable:true only for a registered INWARD class
 * outside the training/health domains and outside scope `autonomy`. Everything
 * else — outward actions, unknown keys, training/health, self-escalation — is
 * refused here, so no code path and no hand-written row can grant it.
 */
export function checkGrantable(key: string): Grantability {
  // Self-escalation lock (hard rule 1) — defense in depth on the key itself.
  if (key === "autonomy" || key.startsWith("autonomy.")) {
    return {
      grantable: false,
      reason:
        "scope 'autonomy' is non-grantable — autonomy never escalates its own autonomy; the grant switch is only ever Cole's hand",
    };
  }
  const cls = getActionClass(key);
  if (!cls) {
    return {
      grantable: false,
      reason: `unknown action class "${key}" — only registered inward classes are grantable`,
    };
  }
  if (cls.tier === "outward") {
    return {
      grantable: false,
      reason: `"${key}" is an OUTWARD action (${cls.gate}) — non-grantable by construction; Cole confirms every instance`,
    };
  }
  if (cls.domain && NON_GRANTABLE_DOMAINS.has(cls.domain)) {
    return {
      grantable: false,
      reason: `"${key}" is in the ${cls.domain} domain — signals only, Cole owns the decision (hard rule 5)`,
    };
  }
  return { grantable: true, reason: `grantable inward action: ${cls.key}`, actionClass: cls };
}
