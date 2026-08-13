// aurelius/crm/service.ts
//
// THE CLIENT ENGINE — the remote coaching business as data.
//
// Scope (2026-08-05, amended 2026-08-08): this is the business Cole OWNS. He
// is employed at the gym, so in-person athletes there belong to his employer.
// Cole's call on 2026-08-08: they may enter this TABLE as kind="training_only"
// (so he has one roster and one PR ledger for everyone he coaches) but they
// NEVER enter the business MACHINERY — no referral asks, no proof content, no
// check-in/renewal drafts, no analytics, no outreach. The exclusion lives in
// the queries (kind: "client"), not in display filters, so a new business
// surface can't accidentally include them. Every function below is INWARD and
// reversible — it records, links,
// and reports. Nothing here sends an email, charges a card, or messages an
// athlete; those are outward actions and stop for Cole's confirm by
// construction (NORTH_STAR §2.5).
//
// Two things this module refuses to do, both deliberate:
//
//   • It will not pretend an empty pipeline is progress. `pipelineSnapshot`
//     reports zero as zero and names the constraint, because Cole's real
//     situation today is no clients and no inbound. A CRM that renders an
//     encouraging dashboard over nothing is the exact failure mode worth
//     avoiding.
//   • It will not compute "overdue" as stored state. An invoice is overdue if
//     dueAt has passed and it isn't paid — derived at read time, so it can
//     never be stale between cron runs.

import { prisma } from "../core/db/prisma.ts";

// ── money ────────────────────────────────────────────────────────────
// Integer cents everywhere. Callers speak dollars because Cole speaks
// dollars; the boundary converts once, here, and rounds explicitly.

/** "$1,200.50" | 1200.5 | "1200" → 120050 cents. Throws on nonsense. */
export function toCents(input: number | string): number {
  const n = typeof input === "number" ? input : Number(String(input).replace(/[$,\s]/g, ""));
  if (!Number.isFinite(n)) throw new Error(`Not a valid amount: ${JSON.stringify(input)}`);
  if (n < 0) throw new Error("Amount cannot be negative.");
  return Math.round(n * 100);
}

/** 120050 → "$1,200.50" */
export function fromCents(cents: number, currency = "usd"): string {
  const symbol = currency.toLowerCase() === "usd" ? "$" : `${currency.toUpperCase()} `;
  return `${symbol}${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ── vocabularies ─────────────────────────────────────────────────────
// Validated on write. A typo'd status silently drops a lead out of every
// query that filters on it — the pipeline would just look emptier.

export const LEAD_STATUSES = ["new", "contacted", "conversing", "proposed", "won", "lost", "dormant"] as const;
export const LEAD_SOURCES = ["manual", "referral", "instagram", "email", "word_of_mouth", "website", "assessment", "other"] as const;
export const CLIENT_STATUSES = ["active", "paused", "ended"] as const;
// "client" = Cole's own business, full machinery. "training_only" = recorded
// athlete (e.g. the gym's), business machinery excluded by construction.
export const CLIENT_KINDS = ["client", "training_only"] as const;
export const ENGAGEMENT_SHAPES = ["monthly", "block", "program"] as const;
export const ENGAGEMENT_STATUSES = ["active", "completed", "cancelled", "pending"] as const;
export const SESSION_KINDS = ["check_in", "call", "video_review", "test", "session"] as const;
export const INVOICE_STATUSES = ["draft", "sent", "partial", "paid", "void"] as const;
export const PAYMENT_METHODS = ["cash", "venmo", "zelle", "stripe", "paypal", "bank", "other"] as const;

function must<T extends readonly string[]>(value: string | undefined, allowed: T, field: string, fallback?: T[number]): T[number] {
  const v = (value ?? fallback ?? allowed[0]) as string;
  if (!allowed.includes(v as any)) {
    throw new Error(`${field} must be one of: ${allowed.join(", ")} (got "${value}")`);
  }
  return v as T[number];
}

function parseDate(input: string | Date | undefined | null, field: string): Date | null {
  if (input === undefined || input === null || input === "") return null;
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) throw new Error(`${field} is not a valid date: ${JSON.stringify(input)}`);
  return d;
}

// ── leads ────────────────────────────────────────────────────────────

export type AddLeadInput = {
  name: string;
  email?: string;
  phone?: string;
  sport?: string;
  gradYear?: number;
  location?: string;
  source?: string;
  referredBy?: string;
  notes?: string;
  nextAction?: string;
  nextActionAt?: string | Date;
};

export async function addLead(input: AddLeadInput) {
  const name = (input.name ?? "").trim();
  if (!name) throw new Error("A lead needs a name.");
  return prisma.lead.create({
    data: {
      name,
      email: input.email?.trim() || null,
      phone: input.phone?.trim() || null,
      sport: input.sport?.trim() || null,
      gradYear: input.gradYear ?? null,
      location: input.location?.trim() || null,
      source: must(input.source, LEAD_SOURCES, "source", "manual"),
      referredBy: input.referredBy?.trim() || null,
      notes: input.notes?.trim() || null,
      nextAction: input.nextAction?.trim() || null,
      nextActionAt: parseDate(input.nextActionAt, "nextActionAt"),
    },
  });
}

export async function listLeads(opts: { status?: string; source?: string; limit?: number } = {}) {
  return prisma.lead.findMany({
    where: {
      ...(opts.status ? { status: must(opts.status, LEAD_STATUSES, "status") } : {}),
      ...(opts.source ? { source: must(opts.source, LEAD_SOURCES, "source") } : {}),
    },
    orderBy: [{ nextActionAt: "asc" }, { createdAt: "desc" }],
    take: Math.min(opts.limit ?? 100, 500),
  });
}

export async function updateLead(
  id: string,
  patch: Partial<AddLeadInput> & { status?: string; lostReason?: string; lastContactAt?: string | Date }
) {
  const existing = await prisma.lead.findUnique({ where: { id } });
  if (!existing) throw new Error(`No lead with id ${id}.`);
  return prisma.lead.update({
    where: { id },
    data: {
      ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
      ...(patch.email !== undefined ? { email: patch.email?.trim() || null } : {}),
      ...(patch.phone !== undefined ? { phone: patch.phone?.trim() || null } : {}),
      ...(patch.sport !== undefined ? { sport: patch.sport?.trim() || null } : {}),
      ...(patch.location !== undefined ? { location: patch.location?.trim() || null } : {}),
      ...(patch.notes !== undefined ? { notes: patch.notes?.trim() || null } : {}),
      ...(patch.referredBy !== undefined ? { referredBy: patch.referredBy?.trim() || null } : {}),
      ...(patch.source !== undefined ? { source: must(patch.source, LEAD_SOURCES, "source") } : {}),
      ...(patch.status !== undefined ? { status: must(patch.status, LEAD_STATUSES, "status") } : {}),
      ...(patch.lostReason !== undefined ? { lostReason: patch.lostReason?.trim() || null } : {}),
      ...(patch.nextAction !== undefined ? { nextAction: patch.nextAction?.trim() || null } : {}),
      ...(patch.nextActionAt !== undefined ? { nextActionAt: parseDate(patch.nextActionAt, "nextActionAt") } : {}),
      ...(patch.lastContactAt !== undefined ? { lastContactAt: parseDate(patch.lastContactAt, "lastContactAt") } : {}),
    },
  });
}

/**
 * Lead → Client. The single most important transition in the file, so it's
 * transactional: a half-converted lead (marked won, no client row) would be
 * invisible in both the pipeline and the roster.
 */
export async function convertLead(
  leadId: string,
  extra: { parentName?: string; parentEmail?: string; parentPhone?: string; isMinor?: boolean; timezone?: string } = {}
) {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) throw new Error(`No lead with id ${leadId}.`);
  if (lead.convertedClientId) throw new Error(`${lead.name} has already been converted.`);

  const client = await prisma.$transaction(async (tx) => {
    const client = await tx.client.create({
      data: {
        name: lead.name,
        email: lead.email,
        phone: lead.phone,
        sport: lead.sport,
        gradYear: lead.gradYear,
        timezone: extra.timezone ?? null,
        parentName: extra.parentName ?? null,
        parentEmail: extra.parentEmail ?? null,
        parentPhone: extra.parentPhone ?? null,
        isMinor: extra.isMinor ?? false,
        notes: lead.notes,
      },
    });
    await tx.lead.update({
      where: { id: leadId },
      data: { status: "won", convertedClientId: client.id, convertedAt: new Date(), nextAction: null, nextActionAt: null },
    });
    return client;
  });

  // THE ONBOARDING RUNWAY — five tasks over 14 days, laid the moment the
  // client exists (crm/onboarding.ts). Inward (tasks + a receipt), fires only
  // on a real conversion, and best-effort OUTSIDE the transaction: a runway
  // failure must never roll back the conversion itself.
  try {
    const { layOnboardingRunway } = await import("./onboarding.ts");
    await layOnboardingRunway(client);
  } catch (err: any) {
    console.warn("[crm] onboarding runway failed (conversion stands):", err?.message ?? err);
  }

  return client;
}

// ── clients ──────────────────────────────────────────────────────────

export async function addClient(input: {
  name: string;
  kind?: string; // "client" (default) | "training_only" — see CLIENT_KINDS
  email?: string;
  phone?: string;
  sport?: string;
  position?: string;
  gradYear?: number;
  timezone?: string;
  parentName?: string;
  parentEmail?: string;
  parentPhone?: string;
  isMinor?: boolean;
  notes?: string;
}) {
  const name = (input.name ?? "").trim();
  if (!name) throw new Error("A client needs a name.");
  return prisma.client.create({
    data: {
      name,
      kind: must(input.kind, CLIENT_KINDS, "kind"),
      email: input.email?.trim() || null,
      phone: input.phone?.trim() || null,
      sport: input.sport?.trim() || null,
      position: input.position?.trim() || null,
      gradYear: input.gradYear ?? null,
      timezone: input.timezone?.trim() || null,
      parentName: input.parentName?.trim() || null,
      parentEmail: input.parentEmail?.trim() || null,
      parentPhone: input.parentPhone?.trim() || null,
      isMinor: input.isMinor ?? false,
      notes: input.notes?.trim() || null,
    },
  });
}

/** Promote a training-only athlete into a real client — Cole's explicit action,
 *  the ONLY door from the training roster into the business machinery. History
 *  (metrics, PRs) carries over; business surfaces pick them up from today
 *  forward (they have no engagements/invoices to backdate). */
export async function promoteClient(id: string) {
  const existing = await prisma.client.findUnique({ where: { id }, select: { id: true, name: true, kind: true } });
  if (!existing) throw new Error("No client with that id.");
  if (existing.kind === "client") throw new Error(`${existing.name} is already a full client.`);
  return prisma.client.update({ where: { id }, data: { kind: "client" } });
}

export async function listClients(opts: { status?: string; kind?: string; limit?: number } = {}) {
  return prisma.client.findMany({
    where: {
      ...(opts.status ? { status: must(opts.status, CLIENT_STATUSES, "status") } : {}),
      // Default to the listable kinds (client + training_only). The self record
      // (Athlete Zero, kind:"self") is Cole, not someone on his roster, so it
      // must never appear in a bare "list clients" — only an explicit kind reaches it.
      ...(opts.kind ? { kind: must(opts.kind, CLIENT_KINDS, "kind") } : { kind: { in: [...CLIENT_KINDS] } }),
    },
    include: { engagements: { where: { status: "active" } } },
    orderBy: { createdAt: "desc" },
    take: Math.min(opts.limit ?? 100, 500),
  });
}

export async function updateClient(id: string, patch: Record<string, any>) {
  const existing = await prisma.client.findUnique({ where: { id } });
  if (!existing) throw new Error(`No client with id ${id}.`);
  const data: Record<string, any> = {};
  for (const f of ["name", "email", "phone", "sport", "position", "timezone", "parentName", "parentEmail", "parentPhone", "notes", "endedReason"]) {
    if (patch[f] !== undefined) data[f] = String(patch[f]).trim() || null;
  }
  // The program sheet link. Only a real Google Sheets URL (or empty to clear) —
  // this gets iframed on the Athletes page, so it never stores an arbitrary URL.
  if (patch.sheetUrl !== undefined) {
    const url = String(patch.sheetUrl ?? "").trim();
    if (url && !/^https:\/\/docs\.google\.com\/spreadsheets\/d\/[\w-]+/.test(url)) {
      throw new Error("sheetUrl must be a Google Sheets link (https://docs.google.com/spreadsheets/d/…) — or empty to clear it.");
    }
    data.sheetUrl = url || null;
  }
  if (patch.gradYear !== undefined) data.gradYear = patch.gradYear ?? null;
  if (patch.isMinor !== undefined) data.isMinor = Boolean(patch.isMinor);
  if (patch.status !== undefined) {
    data.status = must(patch.status, CLIENT_STATUSES, "status");
    if (data.status === "ended" && !existing.endedAt) data.endedAt = new Date();
  }
  return prisma.client.update({ where: { id }, data });
}

// ── engagements (the money terms) ────────────────────────────────────

export type AddEngagementInput = {
  clientId: string;
  shape: string; // monthly | block | program
  title: string;
  price: number | string; // dollars in, cents stored
  startsAt?: string | Date;
  endsAt?: string | Date;
  weeks?: number; // convenience for blocks — endsAt derived when not given
  nextBillingAt?: string | Date;
  autoRenew?: boolean;
  notes?: string;
};

export async function addEngagement(input: AddEngagementInput) {
  const client = await prisma.client.findUnique({ where: { id: input.clientId } });
  if (!client) throw new Error(`No client with id ${input.clientId}.`);
  // An engagement is something they BOUGHT — training-only athletes can't hold
  // one (it would pull them into renewal/treasury machinery). Promote first.
  if (client.kind !== "client") {
    throw new Error(`${client.name} is training-only — they can't hold an engagement. If they've actually signed, promote them to a client first.`);
  }
  const shape = must(input.shape, ENGAGEMENT_SHAPES, "shape");
  const title = (input.title ?? "").trim();
  if (!title) throw new Error("An engagement needs a title.");

  const startsAt = parseDate(input.startsAt, "startsAt") ?? new Date();
  let endsAt = parseDate(input.endsAt, "endsAt");
  let nextBillingAt = parseDate(input.nextBillingAt, "nextBillingAt");

  // Shape-specific defaults. These matter: a block with no end date can never
  // surface as a re-sign conversation, which is the whole point of a block.
  if (shape === "block") {
    if (!endsAt) {
      const weeks = input.weeks ?? 8;
      endsAt = new Date(startsAt.getTime() + weeks * 7 * 24 * 60 * 60 * 1000);
    }
    nextBillingAt = null; // paid up front or invoiced once; not recurring
  } else if (shape === "monthly") {
    if (!nextBillingAt) {
      const d = new Date(startsAt);
      d.setMonth(d.getMonth() + 1);
      nextBillingAt = d;
    }
    endsAt = endsAt ?? null; // open-ended until cancelled
  } else {
    // program — a one-off sale with no ongoing obligation
    endsAt = null;
    nextBillingAt = null;
  }

  return prisma.engagement.create({
    data: {
      clientId: input.clientId,
      shape,
      title,
      priceCents: toCents(input.price),
      startsAt,
      endsAt,
      nextBillingAt,
      autoRenew: input.autoRenew ?? shape === "monthly",
      notes: input.notes?.trim() || null,
    },
  });
}

export async function listEngagements(opts: { clientId?: string; status?: string; shape?: string } = {}) {
  return prisma.engagement.findMany({
    where: {
      ...(opts.clientId ? { clientId: opts.clientId } : {}),
      ...(opts.status ? { status: must(opts.status, ENGAGEMENT_STATUSES, "status") } : {}),
      ...(opts.shape ? { shape: must(opts.shape, ENGAGEMENT_SHAPES, "shape") } : {}),
    },
    include: { client: { select: { id: true, name: true } } },
    orderBy: { startsAt: "desc" },
  });
}

export async function updateEngagement(id: string, patch: Record<string, any>) {
  const existing = await prisma.engagement.findUnique({ where: { id } });
  if (!existing) throw new Error(`No engagement with id ${id}.`);
  const data: Record<string, any> = {};
  if (patch.title !== undefined) data.title = String(patch.title).trim();
  if (patch.price !== undefined) data.priceCents = toCents(patch.price);
  if (patch.status !== undefined) data.status = must(patch.status, ENGAGEMENT_STATUSES, "status");
  if (patch.endsAt !== undefined) data.endsAt = parseDate(patch.endsAt, "endsAt");
  if (patch.nextBillingAt !== undefined) data.nextBillingAt = parseDate(patch.nextBillingAt, "nextBillingAt");
  if (patch.autoRenew !== undefined) data.autoRenew = Boolean(patch.autoRenew);
  if (patch.notes !== undefined) data.notes = String(patch.notes).trim() || null;
  return prisma.engagement.update({ where: { id }, data });
}

// ── sessions ─────────────────────────────────────────────────────────

export async function logSession(input: {
  clientId: string;
  engagementId?: string;
  kind?: string;
  scheduledAt?: string | Date;
  completedAt?: string | Date;
  durationMin?: number;
  notes?: string;
  /** Performance numbers captured in this session — the PR ledger's raw
   *  material (Wave 4). A number that beats the client's prior best for that
   *  label is auto-flagged isPR, which is the peak event a referral ask and a
   *  proof-content draft key off. */
  metrics?: Array<{ label: string; value: number; unit?: string; source?: string }>;
}) {
  const client = await prisma.client.findUnique({ where: { id: input.clientId } });
  if (!client) throw new Error(`No client with id ${input.clientId}.`);
  const session = await prisma.session.create({
    data: {
      clientId: input.clientId,
      engagementId: input.engagementId ?? null,
      kind: must(input.kind, SESSION_KINDS, "kind", "check_in"),
      scheduledAt: parseDate(input.scheduledAt, "scheduledAt"),
      // A session logged with neither date is one that just happened.
      completedAt: parseDate(input.completedAt, "completedAt") ?? (input.scheduledAt ? null : new Date()),
      durationMin: input.durationMin ?? null,
      notes: input.notes?.trim() || null,
    },
  });
  // Logging a session is also when this client was touched — reset the check-in
  // clock so the retention sweep doesn't re-draft a check-in for someone Cole
  // just spoke to. Best-effort.
  await prisma.client.update({ where: { id: input.clientId }, data: { lastCheckInAt: new Date() } }).catch(() => {});
  if (input.metrics?.length) {
    const { logMetric } = await import("./retention.ts");
    for (const m of input.metrics) {
      await logMetric({ clientId: input.clientId, sessionId: session.id, label: m.label, value: m.value, unit: m.unit, source: m.source }).catch(() => {});
    }
  }
  return session;
}

// ── money: owed and received ─────────────────────────────────────────

export async function raiseInvoice(input: {
  clientId: string;
  engagementId?: string;
  amount: number | string;
  description?: string;
  dueAt?: string | Date;
  status?: string;
}) {
  const client = await prisma.client.findUnique({ where: { id: input.clientId } });
  if (!client) throw new Error(`No client with id ${input.clientId}.`);
  // Money never aims at the training roster (the gym boundary).
  if (client.kind !== "client") {
    throw new Error(`${client.name} is training-only — no invoices get raised at them. Promote them to a client first if they've signed.`);
  }
  return prisma.invoice.create({
    data: {
      clientId: input.clientId,
      engagementId: input.engagementId ?? null,
      amountCents: toCents(input.amount),
      description: input.description?.trim() || null,
      dueAt: parseDate(input.dueAt, "dueAt"),
      status: must(input.status, INVOICE_STATUSES, "status", "sent"),
    },
  });
}

/**
 * Record money that ARRIVED, and reconcile its invoice.
 *
 * Transactional and sum-based: an invoice's paid state is recomputed from the
 * total of its payments, never incremented. Increments drift the moment a
 * payment is edited or deleted, and a client wrongly marked paid is a bill
 * Cole never chases.
 */
export async function recordPayment(input: {
  clientId: string;
  invoiceId?: string;
  engagementId?: string;
  amount: number | string;
  method?: string;
  receivedAt?: string | Date;
  externalRef?: string;
  note?: string;
  /** How this was recorded — "cole" (his hand) or a self-recorder like
   *  "stripe_webhook" / "email_parse" / "twilio". Provenance the money ledger
   *  reports, so "money arrived on its own" is a claim it can prove. */
  recordedBy?: string;
}) {
  const client = await prisma.client.findUnique({
    where: { id: input.clientId },
    include: { lead: { select: { source: true, angleId: true, refCode: true, trackLinkId: true } } },
  });
  if (!client) throw new Error(`No client with id ${input.clientId}.`);
  // The gym boundary (council catch): the one money function that skipped the
  // guard its siblings (raiseInvoice, addEngagement) carry. Without it, "Jake
  // paid $300" about a gym athlete books into attribution, the treasury, the
  // scoreboard and the analyst read. Self-record paths already filter kind
  // before calling here; this closes chat/API/router.
  if (client.kind !== "client") {
    throw new Error(`${client.name} is training-only — no payments get recorded against them. Promote them first if they've actually signed.`);
  }
  const amountCents = toCents(input.amount);
  if (amountCents === 0) throw new Error("A payment of zero isn't a payment.");

  const payment = await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.create({
      data: {
        clientId: input.clientId,
        invoiceId: input.invoiceId ?? null,
        engagementId: input.engagementId ?? null,
        amountCents,
        method: must(input.method, PAYMENT_METHODS, "method", "other"),
        receivedAt: parseDate(input.receivedAt, "receivedAt") ?? new Date(),
        externalRef: input.externalRef?.trim() || null,
        note: input.note?.trim() || null,
        recordedBy: (input.recordedBy ?? "cole").slice(0, 40),
      },
    });

    if (input.invoiceId) {
      const invoice = await tx.invoice.findUnique({ where: { id: input.invoiceId } });
      if (!invoice) throw new Error(`No invoice with id ${input.invoiceId}.`);
      const agg = await tx.payment.aggregate({
        where: { invoiceId: input.invoiceId },
        _sum: { amountCents: true },
      });
      const paid = agg._sum.amountCents ?? 0;
      const settled = paid >= invoice.amountCents;
      await tx.invoice.update({
        where: { id: input.invoiceId },
        data: {
          status: settled ? "paid" : paid > 0 ? "partial" : invoice.status,
          paidAt: settled ? new Date() : null,
        },
      });
    }
    return payment;
  });

  // The "paid" touch — money credited to the channel/angle that produced this
  // client. Best-effort, outside the transaction: attribution is a record, not
  // a gate, and must never roll back a real payment.
  const { recordAttribution } = await import("./trackLinks.ts");
  await recordAttribution({
    kind: "paid",
    channel: client.lead?.source ?? "unattributed",
    angleId: client.lead?.angleId ?? null,
    refCode: client.lead?.refCode ?? null,
    trackLinkId: client.lead?.trackLinkId ?? null,
    leadId: null,
    clientId: input.clientId,
    paymentId: payment.id,
    amountCents,
  });

  return payment;
}

/** Unpaid invoices, oldest first. `overdue` is derived, never stored. */
export async function outstandingInvoices(now = new Date()) {
  const rows = await prisma.invoice.findMany({
    where: { status: { in: ["draft", "sent", "partial"] }, client: { kind: "client" } },
    include: { client: { select: { id: true, name: true } }, payments: true },
    orderBy: [{ dueAt: "asc" }, { issuedAt: "asc" }],
  });
  return rows.map((inv) => {
    const paid = inv.payments.reduce((s, p) => s + p.amountCents, 0);
    return {
      id: inv.id,
      client: inv.client.name,
      clientId: inv.clientId,
      amountCents: inv.amountCents,
      paidCents: paid,
      outstandingCents: Math.max(0, inv.amountCents - paid),
      dueAt: inv.dueAt,
      status: inv.status,
      overdue: !!inv.dueAt && inv.dueAt < now,
      description: inv.description,
    };
  });
}

// ── the things worth being reminded of ───────────────────────────────

/**
 * What needs Cole's hand in the next `days`. This is the function the morning
 * briefing should ask, because it's the one that costs money when ignored: a
 * block ending with no re-sign conversation, a monthly renewal, a lead whose
 * follow-up date has passed, an invoice nobody chased.
 */
export async function whatNeedsAttention(days = 14, now = new Date()) {
  const horizon = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  const [endingBlocks, billingDue, staleFollowUps, invoices] = await Promise.all([
    // client.kind filters here are unreachable-by-construction today (guarded
    // creation, no demote path) but the policy is exclusion IN THE QUERY —
    // this feeds the briefing and the deck risk line, the worst places for a
    // hand-edited row to leak a gym athlete into.
    prisma.engagement.findMany({
      where: { status: "active", shape: "block", endsAt: { not: null, lte: horizon }, client: { kind: "client" } },
      include: { client: { select: { id: true, name: true } } },
      orderBy: { endsAt: "asc" },
    }),
    prisma.engagement.findMany({
      where: { status: "active", shape: "monthly", nextBillingAt: { not: null, lte: horizon }, client: { kind: "client" } },
      include: { client: { select: { id: true, name: true } } },
      orderBy: { nextBillingAt: "asc" },
    }),
    prisma.lead.findMany({
      where: { status: { notIn: ["won", "lost"] }, nextActionAt: { not: null, lte: now } },
      orderBy: { nextActionAt: "asc" },
    }),
    outstandingInvoices(now),
  ]);

  return {
    blocksEnding: endingBlocks.map((e) => ({
      engagementId: e.id,
      client: e.client.name,
      clientId: e.clientId,
      title: e.title,
      endsAt: e.endsAt,
      // The re-sign conversation is the point. Say so plainly.
      why: `Block ends ${e.endsAt?.toISOString().slice(0, 10)} — the re-sign conversation is now, not after it lapses.`,
    })),
    renewalsDue: billingDue.map((e) => ({
      engagementId: e.id,
      client: e.client.name,
      clientId: e.clientId,
      title: e.title,
      nextBillingAt: e.nextBillingAt,
      amount: fromCents(e.priceCents, e.currency),
    })),
    followUpsOverdue: staleFollowUps.map((l) => ({
      leadId: l.id,
      name: l.name,
      action: l.nextAction,
      dueAt: l.nextActionAt,
      status: l.status,
    })),
    unpaid: invoices.filter((i) => i.outstandingCents > 0),
  };
}

/**
 * The honest state of the business.
 *
 * Reports zero as zero. When there are no clients and no leads it says the
 * pipeline is empty and names lead generation as the constraint, rather than
 * rendering an empty dashboard that implies the machinery is the achievement.
 */
export async function pipelineSnapshot(now = new Date()) {
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [leadsByStatus, activeClients, totalClients, activeEngagements, monthPayments, allTimePayments, outstanding] =
    await Promise.all([
      prisma.lead.groupBy({ by: ["status"], _count: { _all: true } }),
      // kind: "client" — the business snapshot counts the business, not the
      // training roster (the gym boundary).
      prisma.client.count({ where: { status: "active", kind: "client" } }),
      prisma.client.count({ where: { kind: "client" } }),
      prisma.engagement.findMany({ where: { status: "active", client: { kind: "client" } }, select: { shape: true, priceCents: true } }),
      prisma.payment.aggregate({ where: { receivedAt: { gte: monthStart }, client: { kind: "client" } }, _sum: { amountCents: true } }),
      prisma.payment.aggregate({ where: { client: { kind: "client" } }, _sum: { amountCents: true } }),
      outstandingInvoices(now),
    ]);

  const pipeline: Record<string, number> = {};
  for (const row of leadsByStatus) pipeline[row.status] = row._count._all;
  const openLeads = leadsByStatus
    .filter((r) => !["won", "lost"].includes(r.status))
    .reduce((s, r) => s + r._count._all, 0);

  // Committed monthly revenue — only the "monthly" shape recurs. Counting
  // blocks or one-off programs here would inflate MRR into fiction.
  const mrrCents = activeEngagements.filter((e) => e.shape === "monthly").reduce((s, e) => s + e.priceCents, 0);
  const outstandingCents = outstanding.reduce((s, i) => s + i.outstandingCents, 0);

  const empty = totalClients === 0 && openLeads === 0;

  return {
    empty,
    pipeline,
    openLeads,
    activeClients,
    totalClients,
    engagementsByShape: {
      monthly: activeEngagements.filter((e) => e.shape === "monthly").length,
      block: activeEngagements.filter((e) => e.shape === "block").length,
      program: activeEngagements.filter((e) => e.shape === "program").length,
    },
    mrrCents,
    mrr: fromCents(mrrCents),
    receivedThisMonthCents: monthPayments._sum.amountCents ?? 0,
    receivedThisMonth: fromCents(monthPayments._sum.amountCents ?? 0),
    receivedAllTimeCents: allTimePayments._sum.amountCents ?? 0,
    receivedAllTime: fromCents(allTimePayments._sum.amountCents ?? 0),
    outstandingCents,
    outstanding: fromCents(outstandingCents),
    overdueCount: outstanding.filter((i) => i.overdue).length,
    // The line Aurelius should actually say out loud.
    headline: empty
      ? "The remote pipeline is empty — no clients, no open leads. The constraint is lead generation, not tracking: this roster can't help until there's someone in it. The warm list is the shortest path."
      : `${activeClients} active client${activeClients === 1 ? "" : "s"} · ${openLeads} open lead${openLeads === 1 ? "" : "s"} · ${fromCents(mrrCents)}/mo committed · ${fromCents(monthPayments._sum.amountCents ?? 0)} received this month`,
  };
}

/** One client, everything attached — for "how is Jake doing". */
export async function clientDetail(idOrName: string) {
  const client =
    (await prisma.client.findUnique({ where: { id: idOrName } })) ??
    (await prisma.client.findFirst({ where: { name: { equals: idOrName, mode: "insensitive" } } }));
  if (!client) return null;
  const [engagements, sessions, invoices, payments] = await Promise.all([
    prisma.engagement.findMany({ where: { clientId: client.id }, orderBy: { startsAt: "desc" } }),
    prisma.session.findMany({ where: { clientId: client.id }, orderBy: { createdAt: "desc" }, take: 20 }),
    prisma.invoice.findMany({ where: { clientId: client.id }, orderBy: { issuedAt: "desc" } }),
    prisma.payment.findMany({ where: { clientId: client.id }, orderBy: { receivedAt: "desc" } }),
  ]);
  const lifetimeCents = payments.reduce((s, p) => s + p.amountCents, 0);
  return { client, engagements, sessions, invoices, payments, lifetimeCents, lifetime: fromCents(lifetimeCents) };
}

/** Resolve a client by name for chat ("log a check-in for Jake"). */
export async function findClientByName(name: string) {
  const matches = await prisma.client.findMany({
    where: { name: { contains: name.trim(), mode: "insensitive" } },
    select: { id: true, name: true },
    take: 5,
  });
  return matches;
}
