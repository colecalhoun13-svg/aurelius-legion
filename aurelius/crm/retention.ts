// aurelius/crm/retention.ts
//
// RETENTION & REFERRAL — the cheapest growth, built now, dormant until client #1.
//
// Keeping a paying athlete and turning a happy one into the next lead beats any
// funnel on cost. But neither can be tested with zero clients, and rendering
// retention theatre over an empty roster is exactly the dishonesty this system
// refuses. So every function here is dormant-honest: it runs, finds no clients,
// and says so — no fabricated check-ins, no imaginary PRs.
//
// The through-line is the PR. A personal best is the ONE moment when an athlete
// (and the parent who pays) is most convinced Cole is worth it — so it is the
// natural trigger for a referral ask AND the raw material for proof content.
// Everything outward here (the referral ask, the proof post) stops for Cole's
// confirm; nothing sends or publishes on its own.

import { prisma } from "../core/db/prisma.ts";
import { fromCents } from "./service.ts";

// Times/sprints improve DOWNWARD; strength/jumps improve UPWARD. Getting this
// wrong would call a slower 40 a "PR", so it's explicit.
const LOWER_IS_BETTER = /dash|sprint|\btime\b|\b40\b|10-?yard|5-?10-?5|agility|mile|:/i;
function beats(label: string, value: number, prior: number): boolean {
  return LOWER_IS_BETTER.test(label) ? value < prior : value > prior;
}

/** Record a performance number. Auto-flags a personal best (a prior exists and
 *  is beaten), and on a PR fires peak detection. First entry for a label is a
 *  baseline, not a PR. */
export async function logMetric(input: {
  clientId: string;
  label: string;
  value: number;
  unit?: string;
  sessionId?: string;
  source?: string;
}): Promise<{ metricId: string; isPR: boolean }> {
  const label = input.label.trim();
  const priors = await prisma.metric.findMany({
    where: { clientId: input.clientId, label: { equals: label, mode: "insensitive" } },
    select: { value: true },
  });
  let isPR = false;
  if (priors.length > 0) {
    const best = LOWER_IS_BETTER.test(label)
      ? Math.min(...priors.map((p) => p.value))
      : Math.max(...priors.map((p) => p.value));
    isPR = beats(label, input.value, best);
  }
  const metric = await prisma.metric.create({
    data: {
      clientId: input.clientId,
      sessionId: input.sessionId ?? null,
      label,
      value: input.value,
      unit: input.unit ?? null,
      isPR,
      source: input.source ?? "coach",
    },
  });
  if (isPR) await onPeak(input.clientId, { label, value: input.value, unit: input.unit }).catch(() => {});
  return { metricId: metric.id, isPR };
}

/** A PR just landed — the highest-leverage moment. Propose a referral ask and
 *  surface the win. Deduped per client per day so a session with three PRs asks
 *  once, not three times. */
async function onPeak(clientId: string, pr: { label: string; value: number; unit?: string }): Promise<void> {
  const client = await prisma.client.findUnique({ where: { id: clientId }, select: { name: true, isMinor: true } });
  if (!client) return;

  // One referral proposal per client per open window — never nag.
  const open = await prisma.referral.count({ where: { referrerClientId: clientId, status: "proposed" } });
  if (open === 0) {
    await prisma.referral.create({ data: { referrerClientId: clientId, reason: "pr", status: "proposed", askDraftedAt: new Date() } });
  }

  const { surfaceSignal } = await import("../core/bridge.ts");
  await surfaceSignal({
    kind: "opportunity",
    domain: "business",
    sourceType: "pr_peak",
    sourceId: `peak:${clientId}:${new Date().toISOString().slice(0, 10)}`,
    severity: "attention",
    title: `${client.name} just hit a PR — ${pr.label} ${pr.value}${pr.unit ?? ""}`,
    body:
      `This is the moment they're most convinced. Two things worth doing while it's hot:\n` +
      `• Ask ${client.isMinor ? "their parent" : "them"} who else wants this — a referral now converts better than any ad.\n` +
      `• With consent, this PR becomes proof content (anonymised for a minor).\n` +
      `Open the Business page → ${client.name}'s card to draft either — the referral ask or the proof post.`,
  }).catch(() => {});
}

/** The daily retention sweep: overdue check-ins + renewals coming due. Dormant-
 *  honest — returns zeros and a plain reason when there are no clients. Drafts
 *  are inward; any send/publish they lead to stays Cole's confirm. */
export async function retentionSweep(now = new Date()): Promise<{
  ran: boolean;
  reason: string;
  checkInsDue: number;
  renewalsDue: number;
}> {
  const activeClients = await prisma.client.count({ where: { status: "active" } });
  if (activeClients === 0) {
    return { ran: false, reason: "no active clients — retention dormant", checkInsDue: 0, renewalsDue: 0 };
  }

  // Overdue check-ins: a client with a cadence whose clock has run out.
  const clients = await prisma.client.findMany({
    where: { status: "active", checkInEveryDays: { not: null } },
    select: { id: true, name: true, checkInEveryDays: true, lastCheckInAt: true, createdAt: true },
  });
  let checkInsDue = 0;
  for (const c of clients) {
    const since = c.lastCheckInAt ?? c.createdAt;
    const dueAt = new Date(since.getTime() + (c.checkInEveryDays ?? 0) * 86400_000);
    if (dueAt <= now) {
      checkInsDue++;
      await surfaceCheckIn(c.id, c.name, Math.round((now.getTime() - dueAt.getTime()) / 86400_000));
    }
  }

  // Renewals: engagements ending within 21 days are the re-sign conversation.
  const soon = new Date(now.getTime() + 21 * 86400_000);
  const ending = await prisma.engagement.findMany({
    where: { status: "active", endsAt: { not: null, gte: now, lte: soon } },
    select: { id: true, clientId: true, title: true, endsAt: true, priceCents: true },
  });
  for (const e of ending) await surfaceRenewal(e).catch(() => {});

  return { ran: true, reason: "swept", checkInsDue, renewalsDue: ending.length };
}

async function surfaceCheckIn(clientId: string, name: string, daysOverdue: number): Promise<void> {
  const { surfaceSignal } = await import("../core/bridge.ts");
  await surfaceSignal({
    kind: "opportunity",
    domain: "business",
    sourceType: "check_in_due",
    sourceId: `checkin:${clientId}`,
    severity: daysOverdue > 3 ? "attention" : "notice",
    title: `${name} is due a check-in${daysOverdue > 0 ? ` (${daysOverdue}d over)` : ""}`,
    body: `A paying athlete going quiet is how a renewal quietly turns into a churn. Reach out — open the Business page → ${name}'s card and I'll draft the check-in for you to send.`,
  }).catch(() => {});
}

async function surfaceRenewal(e: { id: string; clientId: string; title: string; endsAt: Date | null; priceCents: number }): Promise<void> {
  const client = await prisma.client.findUnique({ where: { id: e.clientId }, select: { name: true } });
  const lifetime = await prisma.payment.aggregate({ where: { clientId: e.clientId }, _sum: { amountCents: true } });
  const prs = await prisma.metric.count({ where: { clientId: e.clientId, isPR: true } });
  const { surfaceSignal } = await import("../core/bridge.ts");
  await surfaceSignal({
    kind: "opportunity",
    domain: "business",
    sourceType: "renewal_due",
    sourceId: `renewal:${e.id}`,
    severity: "attention",
    title: `${client?.name ?? "A client"}'s ${e.title} ends soon — re-sign now`,
    body:
      `The re-sign conversation happens before it lapses, not after. Frame it on what they've earned: ` +
      `${fromCents(lifetime._sum.amountCents ?? 0)} invested${prs > 0 ? `, ${prs} personal best${prs === 1 ? "" : "s"} logged` : ""}. ` +
      `Momentum is the argument. Open the Business page → ${client?.name ?? "their"} card and I'll draft the re-sign for you to send.`,
  }).catch(() => {});
}

/**
 * A referred lead arrived — close the loop. Finds an active client whose name
 * matches the referrer, links the lead, and moves the referral to "captured"
 * (proposing a thank-you). No match → nothing happens (the lead still stands).
 */
export async function creditReferral(leadId: string, referrerName: string): Promise<boolean> {
  const referrer = await prisma.client.findFirst({
    where: { status: "active", name: { equals: referrerName.trim(), mode: "insensitive" } },
    select: { id: true, name: true },
  });
  if (!referrer) return false;
  // Prefer an open referral for this client; else create the captured record so
  // the credit isn't lost just because no ask was formally proposed first.
  const open = await prisma.referral.findFirst({
    where: { referrerClientId: referrer.id, status: { in: ["asked", "proposed"] } },
    orderBy: { createdAt: "desc" },
  });
  if (open) {
    await prisma.referral.update({ where: { id: open.id }, data: { status: "captured", referredLeadId: leadId, capturedAt: new Date() } });
  } else {
    await prisma.referral.create({ data: { referrerClientId: referrer.id, reason: "manual", status: "captured", referredLeadId: leadId, capturedAt: new Date() } });
  }
  const { surfaceSignal } = await import("../core/bridge.ts");
  await surfaceSignal({
    kind: "opportunity",
    domain: "business",
    sourceType: "referral_captured",
    sourceId: `referral:${leadId}`,
    severity: "attention",
    title: `${referrer.name} sent you a referral`,
    body: `A new lead came in crediting ${referrer.name}. Two jobs: work the lead, and thank ${referrer.name} — a thanked referrer refers again.`,
  }).catch(() => {});
  return true;
}

/** Everything the client-detail retention view needs. */
export async function clientRetentionView(clientId: string) {
  const [client, metrics, referrals] = await Promise.all([
    prisma.client.findUnique({ where: { id: clientId }, select: { name: true, isMinor: true, checkInEveryDays: true, lastCheckInAt: true, createdAt: true } }),
    prisma.metric.findMany({ where: { clientId }, orderBy: { achievedAt: "desc" }, take: 30 }),
    prisma.referral.findMany({ where: { referrerClientId: clientId }, orderBy: { createdAt: "desc" } }),
  ]);
  if (!client) return null;
  const prs = metrics.filter((m) => m.isPR);
  const nextCheckIn =
    client.checkInEveryDays != null
      ? new Date((client.lastCheckInAt ?? client.createdAt).getTime() + client.checkInEveryDays * 86400_000)
      : null;
  return {
    name: client.name,
    isMinor: client.isMinor,
    checkInEveryDays: client.checkInEveryDays,
    lastCheckInAt: client.lastCheckInAt,
    nextCheckInAt: nextCheckIn,
    metrics,
    prCount: prs.length,
    referrals,
  };
}

/**
 * The proof engine (4.5): turn a PR into a content draft. Anonymised for a
 * minor by default (consent for a minor's likeness is the parent's to give),
 * and INWARD — it writes a draft into the content queue; publishing is the
 * separate outward content.publish confirm. Dormant-honest without an engine.
 */
export async function draftProofContent(clientId: string): Promise<{ ok: boolean; error?: string; draftId?: string }> {
  const client = await prisma.client.findUnique({ where: { id: clientId }, select: { name: true, sport: true, isMinor: true } });
  if (!client) return { ok: false, error: "No such client." };
  const prs = await prisma.metric.findMany({ where: { clientId, isPR: true }, orderBy: { achievedAt: "desc" }, take: 3 });
  if (prs.length === 0) return { ok: false, error: "No PRs on record for this client yet — nothing to prove." };

  const { runLLM } = await import("../llm/runLLM.ts");
  const { engineUnavailableText } = await import("../llm/nonAnswer.ts");
  const { businessContextBlock } = await import("../business/positioning.ts");
  const { brandVoiceBlock } = await import("../business/brand.ts");

  // Anonymise a minor (and default to anonymised — the safe direction).
  const subject = client.isMinor ? `a ${client.sport ?? "high-school"} athlete` : client.name;
  const prLines = prs.map((p) => `- ${p.label}: ${p.value}${p.unit ?? ""}`).join("\n");

  const res = await runLLM({
    taskType: "chat",
    operators: { primary: "content", secondaries: ["business"] },
    noReuse: true,
    omitToolCatalog: true,
    input:
      `${await businessContextBlock()}\n\n${brandVoiceBlock()}\n\n` +
      `Write a short proof post about ${subject}'s recent personal bests:\n${prLines}\n\n` +
      `RULES — not style preferences:\n` +
      `- ${client.isMinor ? "This athlete is a MINOR — do NOT use their name, and imply nothing that identifies them. Consent for a minor's likeness is the parent's, not yours." : "Use their first name only."}\n` +
      `- Standard-setter, not guarantee coach. These are real numbers this athlete earned — never promise the reader the same result.\n` +
      `- Lead with the dichotomy voice; end on an engagement question. Return ONLY the caption.`,
  });
  const body = (res.text ?? "").trim();
  if (!body || engineUnavailableText(body)) {
    return { ok: false, error: "No engine available — refusing to invent proof content. Nothing filed." };
  }
  const { saveDraft } = await import("../content/queue.ts");
  const kept = await saveDraft({ body, channel: "instagram", title: `Proof — ${subject}` });
  if (!kept.ok) return { ok: false, error: kept.error ?? "not_kept" };
  return { ok: true, draftId: kept.id };
}

/**
 * Draft a client-facing message — a check-in, a re-sign, or a referral ask.
 * INWARD: writes the copy for Cole to review and send himself (sending is
 * outward, his hand). Grounded in the brand voice and the client's real
 * numbers, never a generic template. Dormant-honest without an engine.
 */
export async function draftClientMessage(
  clientId: string,
  kind: "checkin" | "resign" | "referral"
): Promise<{ ok: boolean; error?: string; body?: string }> {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { name: true, sport: true, isMinor: true, parentName: true },
  });
  if (!client) return { ok: false, error: "No such client." };

  const [prs, lifetime] = await Promise.all([
    prisma.metric.count({ where: { clientId, isPR: true } }),
    prisma.payment.aggregate({ where: { clientId }, _sum: { amountCents: true } }),
  ]);

  const { runLLM } = await import("../llm/runLLM.ts");
  const { engineUnavailableText } = await import("../llm/nonAnswer.ts");
  const { brandVoiceBlock } = await import("../business/brand.ts");

  const audience = client.isMinor && client.parentName ? `${client.parentName} (the parent)` : client.name;
  const ask =
    kind === "checkin"
      ? `Write a short, warm check-in to ${audience} about ${client.name}'s training. Ask how it's going, name one specific thing to look at next. No pitch.`
      : kind === "resign"
        ? `Write a short re-sign message to ${audience}. Their block is ending. Frame it on momentum earned (${prs} personal best${prs === 1 ? "" : "s"}, ${fromCents(lifetime._sum.amountCents ?? 0)} invested), and make continuing the obvious next step. Not pushy — confident.`
        : `Write a short referral ask to ${audience}. ${client.name} is doing well. Ask, naturally, who else — a teammate, a friend — would want the same. Make it easy to say a name.`;

  const res = await runLLM({
    taskType: "chat",
    operators: { primary: "business", secondaries: ["content"] },
    noReuse: true,
    omitToolCatalog: true,
    input:
      `${brandVoiceBlock()}\n\n${ask}\n\n` +
      `RULES: standard-setter not guarantee coach; under 100 words; one clear ask; no fake urgency, no emoji spam. Return ONLY the message body.`,
  });
  const body = (res.text ?? "").trim();
  if (!body || body.length < 20 || engineUnavailableText(body)) {
    return { ok: false, error: "No engine available — refusing to draft a message to a real client. Nothing filed." };
  }
  if (kind === "referral") {
    // Mark the freshest open referral proposal as asked (best-effort).
    await prisma.referral
      .updateMany({ where: { referrerClientId: clientId, status: "proposed" }, data: { status: "asked", askedAt: new Date() } })
      .catch(() => {});
  }
  return { ok: true, body };
}

/**
 * Retention analytics (4.6): price confrontation, LTV-weighted channel, churn.
 * SILENT until there's enough data to be honest — below the threshold it reports
 * "too early", never a number computed from one or two clients.
 */
const MIN_CLIENTS_FOR_ANALYTICS = 5;
export async function retentionAnalytics(): Promise<{ ready: boolean; note: string; avgLtvCents?: number; churnRiskCount?: number }> {
  const total = await prisma.client.count();
  if (total < MIN_CLIENTS_FOR_ANALYTICS) {
    return { ready: false, note: `Too early for retention analytics — ${total}/${MIN_CLIENTS_FOR_ANALYTICS} clients. LTV, price confrontation and churn need real numbers to mean anything.` };
  }
  const payments = await prisma.payment.groupBy({ by: ["clientId"], _sum: { amountCents: true } });
  const avgLtvCents = payments.length ? Math.round(payments.reduce((s, p) => s + (p._sum.amountCents ?? 0), 0) / payments.length) : 0;
  // Churn risk: active clients with a cadence who are well past their check-in.
  const now = Date.now();
  const stale = await prisma.client.findMany({
    where: { status: "active", checkInEveryDays: { not: null } },
    select: { checkInEveryDays: true, lastCheckInAt: true, createdAt: true },
  });
  const churnRiskCount = stale.filter((c) => {
    const since = c.lastCheckInAt ?? c.createdAt;
    return now - since.getTime() > (c.checkInEveryDays ?? 0) * 86400_000 * 2; // 2× cadence overdue
  }).length;
  return {
    ready: true,
    note: `${fromCents(avgLtvCents)} average lifetime value across ${payments.length} paying client(s); ${churnRiskCount} at churn risk.`,
    avgLtvCents,
    churnRiskCount,
  };
}
