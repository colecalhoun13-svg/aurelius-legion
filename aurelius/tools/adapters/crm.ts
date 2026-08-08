// aurelius/tools/adapters/crm.ts
//
// The remote coaching business as a REGISTERED TOOL — so "add Jake as a lead",
// "convert Jake", "log a check-in", "Jake paid $200", "who owes me money",
// "what's the pipeline" all work in the normal chat.
//
// Pure delegation to crm/service.ts. Everything here is INWARD and reversible:
// it records what Cole tells it and reports what's recorded. Nothing emails an
// athlete, nothing charges a card, nothing publishes. `raise_invoice` records
// that an invoice is OWED — it does not send one; sending is outward and stops
// for Cole's confirm (NORTH_STAR §2.5).

import type { ToolAdapter, ToolAdapterResult } from "../types.ts";
import {
  addLead,
  listLeads,
  updateLead,
  convertLead,
  addClient,
  listClients,
  updateClient,
  addEngagement,
  listEngagements,
  updateEngagement,
  logSession,
  raiseInvoice,
  recordPayment,
  outstandingInvoices,
  whatNeedsAttention,
  pipelineSnapshot,
  clientDetail,
  findClientByName,
  fromCents,
} from "../../crm/service.ts";
import { importWarmList, draftOutreach, runOutreachSweep } from "../../crm/leadEngine.ts";
import { stageSms } from "../../crm/sms.ts";
import { addExpense, listExpenses, expenseSummary, EXPENSE_CATEGORIES } from "../../business/expenses.ts";

/**
 * Accept a client id OR a name, because Cole will always say "Jake".
 * An ambiguous name is an ERROR, not a guess — silently picking the first
 * match would file a payment against the wrong athlete.
 */
async function resolveClientId(data: Record<string, any>): Promise<string> {
  if (data.clientId) return String(data.clientId);
  const name = String(data.client ?? data.name ?? "").trim();
  if (!name) throw new Error("Which client? Give a name or a clientId.");
  const matches = await findClientByName(name);
  if (matches.length === 0) throw new Error(`No client matching "${name}".`);
  if (matches.length > 1) {
    throw new Error(`"${name}" matches ${matches.length} clients: ${matches.map((m) => m.name).join(", ")}. Be more specific.`);
  }
  return matches[0]!.id;
}

export const crmAdapter: ToolAdapter = {
  name: "crm",
  // NON-IDEMPOTENT — never auto-retry. The engine's timeout does not cancel an
  // in-flight promise, so a slow write that trips the ceiling would land AND be
  // retried: two leads, or worse, two payments against one invoice.
  maxRetries: 0,
  description:
    "Cole's remote coaching business: leads, clients, engagements (monthly / block / one-off program), sessions, invoices owed and payments received. Records and reports only — never sends, bills, or messages anyone. Covers the remote business Cole owns, NOT the athletes at the gym where he is employed.",
  actions: [
    {
      name: "pipeline",
      description:
        "The honest state of the business: leads by stage, active clients, committed monthly revenue, received this month, outstanding. Use for 'how's the business', 'what's my pipeline', 'how much did I make'.",
      dataSchema: "{} (no fields)",
    },
    {
      name: "needs_attention",
      description:
        "What costs money if ignored in the next N days: blocks ending (the re-sign conversation), monthly renewals due, lead follow-ups past their date, unpaid invoices. Use for 'what needs me', and in the morning briefing.",
      dataSchema: "{ days?: number (default 14) }",
    },
    {
      name: "add_lead",
      description:
        "Add someone who might become a client. Use for 'add X as a lead', 'X's mom asked about coaching'. source is where they came from.",
      dataSchema:
        '{ name: string, email?: string, phone?: string, sport?: string, gradYear?: number, location?: string, source?: "manual"|"referral"|"instagram"|"email"|"word_of_mouth"|"website"|"other", referredBy?: string, notes?: string, nextAction?: string, nextActionAt?: string (ISO) }',
      example:
        '[TOOL: crm.add_lead {"name": "Jake Miller", "sport": "football", "source": "referral", "referredBy": "Coach Davis", "nextAction": "Send the intake questions", "nextActionAt": "2026-08-08"}]',
    },
    {
      name: "list_leads",
      description: "List leads, optionally filtered by status or source.",
      dataSchema: '{ status?: "new"|"contacted"|"conversing"|"proposed"|"won"|"lost"|"dormant", source?: string, limit?: number }',
    },
    {
      name: "update_lead",
      description:
        "Update a lead — move its status, set the next follow-up, record why it died. Use for 'Jake went cold', 'follow up with Jake Friday'.",
      dataSchema:
        '{ id: string, status?: string, nextAction?: string, nextActionAt?: string (ISO), lastContactAt?: string (ISO), lostReason?: string, notes?: string }',
    },
    {
      name: "convert_lead",
      description:
        "Turn a lead into a client. Use for 'Jake signed', 'Jake's in'. Records the parent as buyer when given — for high-school athletes the parent usually pays.",
      dataSchema: '{ leadId: string, parentName?: string, parentEmail?: string, parentPhone?: string, isMinor?: boolean, timezone?: string }',
    },
    {
      name: "add_client",
      description:
        "Add someone to the roster directly, skipping the lead stage. kind 'client' (default) = a signed client of Cole's business. kind 'training_only' = an athlete Cole records training for WITHOUT any business machinery (no referral asks, no check-in drafts, no invoices) — use for 'add Jake as a training-only athlete' / 'track Jake but he's not a client'.",
      dataSchema:
        '{ name: string, kind?: "client"|"training_only", email?: string, phone?: string, sport?: string, position?: string, gradYear?: number, timezone?: string, parentName?: string, parentEmail?: string, parentPhone?: string, isMinor?: boolean, notes?: string }',
      example: '[TOOL: crm.add_client {"name": "Jake Miller", "kind": "training_only", "sport": "football"}]',
    },
    {
      name: "list_clients",
      description: "The roster, with active engagements attached. kind filters business clients vs training-only athletes.",
      dataSchema: '{ status?: "active"|"paused"|"ended", kind?: "client"|"training_only", limit?: number }',
    },
    {
      name: "promote_client",
      description:
        "Promote a training-only athlete into a full business client — the ONLY door from the training roster into business machinery. Use when a tracked athlete actually signs. History (metrics, PRs) carries over.",
      dataSchema: '{ client: string (name or id) }',
    },
    {
      name: "athlete_performance",
      description:
        "One athlete's performance: every measured lift/test as a time series with trend, stall/streak flags, targets with pace, recent sessions, PRs. Use for 'how are Jake's numbers trending', 'show me Jake's squat progress'. Works for clients AND training-only athletes.",
      dataSchema: '{ client: string (name or id) }',
    },
    {
      name: "set_target",
      description:
        "Set (or update) a performance target for an athlete — 'Jake should squat 315 by November'. Pace (ahead/on/behind) derives from their logged trend; hitting the number in a logged metric stamps it achieved. One open target per measure — setting again replaces it. Training domain, both athlete kinds.",
      dataSchema: '{ client: string (name or id), label: string, targetValue: number, unit?: string, targetDate?: string (ISO), note?: string }',
      example: '[TOOL: crm.set_target {"client": "Jake Miller", "label": "squat", "targetValue": 315, "unit": "lbs", "targetDate": "2026-11-01"}]',
    },
    {
      name: "drop_target",
      description: "Remove a target (from athlete_performance's targets list — use its id).",
      dataSchema: '{ targetId: string }',
    },
    {
      name: "client_detail",
      description:
        "Everything about one client: engagements, recent sessions, invoices, payments, lifetime value. Use for 'how's Jake doing', 'what's Jake on'.",
      dataSchema: '{ client: string (name or id) }',
      example: '[TOOL: crm.client_detail {"client": "Jake Miller"}]',
    },
    {
      name: "update_client",
      description: "Update a client — pause, end, correct details, or link their program sheet (sheetUrl: a Google Sheets link; empty string clears it).",
      dataSchema: '{ clientId: string, status?: "active"|"paused"|"ended", endedReason?: string, notes?: string, sheetUrl?: string, ... }',
    },
    {
      name: "add_engagement",
      description:
        "What a client bought and on what terms. shape is 'monthly' (recurring), 'block' (fixed 8-12 weeks — endsAt drives the re-sign reminder), or 'program' (one-off sale). price is in dollars.",
      dataSchema:
        '{ client: string (name or id), shape: "monthly"|"block"|"program", title: string, price: number, startsAt?: string (ISO), weeks?: number (blocks, default 8), endsAt?: string (ISO), autoRenew?: boolean, notes?: string }',
      example:
        '[TOOL: crm.add_engagement {"client": "Jake Miller", "shape": "block", "title": "Off-season speed block", "price": 600, "weeks": 12}]',
    },
    {
      name: "list_engagements",
      description: "Engagements, optionally filtered by client, status, or shape.",
      dataSchema: '{ client?: string, status?: string, shape?: "monthly"|"block"|"program" }',
    },
    {
      name: "update_engagement",
      description: "Update an engagement — complete it, cancel it, change the price or end date.",
      dataSchema: '{ engagementId: string, status?: string, price?: number, endsAt?: string (ISO), autoRenew?: boolean, notes?: string }',
    },
    {
      name: "log_session",
      description:
        "Record a coaching touchpoint — a check-in, a call, a video review, a test. Use for 'logged Jake's check-in', 'reviewed Jake's squat video'.",
      dataSchema:
        '{ client: string (name or id), kind?: "check_in"|"call"|"video_review"|"test"|"session", scheduledAt?: string (ISO), completedAt?: string (ISO), durationMin?: number, notes?: string }',
      example: '[TOOL: crm.log_session {"client": "Jake Miller", "kind": "video_review", "notes": "Squat depth much better; still cutting the last rep short."}]',
    },
    {
      name: "raise_invoice",
      description:
        "Record that money is OWED. This does NOT send anything to anyone — it puts the amount on the books so it can be chased. amount is in dollars.",
      dataSchema: '{ client: string (name or id), amount: number, description?: string, dueAt?: string (ISO), engagementId?: string }',
      example: '[TOOL: crm.raise_invoice {"client": "Jake Miller", "amount": 600, "description": "12-week speed block", "dueAt": "2026-08-15"}]',
    },
    {
      name: "record_payment",
      description:
        "Record money that ARRIVED. Links to an invoice when given and settles it (partial payments supported). amount is in dollars.",
      dataSchema:
        '{ client: string (name or id), amount: number, invoiceId?: string, method?: "cash"|"venmo"|"zelle"|"stripe"|"paypal"|"bank"|"other", receivedAt?: string (ISO), note?: string }',
      example: '[TOOL: crm.record_payment {"client": "Jake Miller", "amount": 300, "method": "venmo"}]',
    },
    {
      name: "import_warm_list",
      description:
        "Add the people Cole already knows — former athletes, their parents, coaches, anyone who might say yes or know someone who would. THE most useful action in this tool: he has no inbound, so the warm list is the only channel that works at zero audience. Deduped, and every entry gets a follow-up date immediately.",
      dataSchema:
        '{ entries: [{ name: string, email?: string, phone?: string, sport?: string, relationship?: string, context?: string }], source?: string }',
      example:
        '[TOOL: crm.import_warm_list {"entries": [{"name": "Jake Miller", "email": "dana@example.com", "sport": "football", "relationship": "former athlete", "context": "trained with him 2 years, went to state"}]}]',
    },
    {
      name: "draft_outreach",
      description:
        "Research one lead and draft a personal message to them into Gmail drafts. INWARD — it never sends. Use for 'write to Jake', 'draft something for that lead'.",
      dataSchema: '{ leadId: string }',
    },
    {
      name: "outreach_sweep",
      description:
        "Draft outreach for every lead whose follow-up is due (bounded to 3). Runs daily at 07:30 on its own; use this to run it now.",
      dataSchema: "{ max?: number }",
    },
    {
      name: "outstanding",
      description: "Who owes money, oldest first, with overdue flagged. Use for 'who owes me', 'what's unpaid'.",
      dataSchema: "{} (no fields)",
    },
    {
      name: "record_expense",
      description:
        "Record what the business COSTS — a tool subscription, equipment, a course, platform fees. Capture-only book entry: nothing is deducted or filed anywhere. amount is in dollars. Use for 'I paid $15 for TrueCoach', 'expense: $40 bands'.",
      dataSchema:
        '{ amount: number (dollars), category?: "software"|"equipment"|"education"|"marketing"|"fees"|"other", note?: string, incurredAt?: string (ISO) }',
      example: '[TOOL: crm.record_expense {"amount": 14.99, "category": "software", "note": "TrueCoach monthly"}]',
    },
    {
      name: "expenses",
      description:
        "What the business spent — a month's total, by category, with recent entries and the quarterly estimated-tax reminder. Use for 'what am I spending', 'expenses this month'.",
      dataSchema: '{ month?: string (YYYY-MM, default this month) }',
    },
    {
      name: "text_lead",
      description:
        "STAGE a text message to a lead or client for your confirm — it does NOT send. Sending an SMS is an outward action, so this prepares it and stops on the Bridge for your Confirm tap. Needs Twilio configured. Use for 'text Jake: ...'.",
      dataSchema: '{ leadId?: string, clientId?: string, to?: string (raw number), body: string }',
      example: '[TOOL: crm.text_lead {"leadId": "abc123", "body": "Hey Jake — still want to lock in that speed block?"}]',
    },
  ],

  async run(action: string, data: Record<string, any>): Promise<ToolAdapterResult> {
    try {
      switch (action) {
        case "pipeline":
          return { ok: true, output: await pipelineSnapshot() };

        case "needs_attention":
          return { ok: true, output: await whatNeedsAttention(Number(data.days) || 14) };

        case "add_lead": {
          const lead = await addLead(data as any);
          return { ok: true, output: { id: lead.id, name: lead.name, status: lead.status, message: `${lead.name} is in the pipeline.` } };
        }

        case "list_leads": {
          const leads = await listLeads(data as any);
          return { ok: true, output: { count: leads.length, leads } };
        }

        case "update_lead": {
          if (!data.id) throw new Error("update_lead needs the lead's id (from list_leads).");
          const lead = await updateLead(String(data.id), data as any);
          return { ok: true, output: { id: lead.id, name: lead.name, status: lead.status } };
        }

        case "convert_lead": {
          if (!data.leadId) throw new Error("convert_lead needs leadId (from list_leads).");
          const client = await convertLead(String(data.leadId), data as any);
          return {
            ok: true,
            output: {
              clientId: client.id,
              name: client.name,
              message: `${client.name} is a client. The onboarding runway is on your task list — 5 steps over 14 days (welcome draft, intake, program sheet by day 3, day-7 check-in, day-14 review). Add an engagement to record what they bought.`,
            },
          };
        }

        case "add_client": {
          const client = await addClient(data as any);
          return { ok: true, output: { clientId: client.id, name: client.name } };
        }

        case "list_clients": {
          const clients = await listClients(data as any);
          return { ok: true, output: { count: clients.length, clients } };
        }

        case "promote_client": {
          const id = await resolveClientId(data);
          const { promoteClient } = await import("../../crm/service.ts");
          const client = await promoteClient(id);
          return {
            ok: true,
            output: {
              clientId: client.id,
              name: client.name,
              kind: client.kind,
              message: `${client.name} is now a full client — business machinery (check-ins, renewals, referrals) applies from today. Add an engagement to record what they bought.`,
            },
          };
        }

        case "athlete_performance": {
          const id = await resolveClientId(data);
          const { athletePerformance } = await import("../../crm/performance.ts");
          const view = await athletePerformance(id);
          if (!view) return { ok: false, output: null, error: "No athlete matching that." };
          return { ok: true, output: view as any };
        }

        case "set_target": {
          const clientId = await resolveClientId(data);
          const { setTarget } = await import("../../crm/targets.ts");
          const t = await setTarget({ ...(data as any), clientId, targetValue: Number(data.targetValue) });
          return {
            ok: true,
            output: { targetId: t.id, label: t.label, targetValue: t.targetValue, unit: t.unit, targetDate: t.targetDate },
          };
        }

        case "drop_target": {
          if (!data.targetId) throw new Error("drop_target needs targetId (from athlete_performance's targets).");
          const { dropTarget } = await import("../../crm/targets.ts");
          return { ok: true, output: await dropTarget(String(data.targetId)) as any };
        }

        case "client_detail": {
          const key = String(data.client ?? data.clientId ?? data.name ?? "").trim();
          if (!key) throw new Error("client_detail needs a client name or id.");
          const detail = await clientDetail(key);
          if (!detail) return { ok: false, output: null, error: `No client matching "${key}".` };
          return { ok: true, output: detail as any };
        }

        case "update_client": {
          const id = await resolveClientId(data);
          const client = await updateClient(id, data);
          return { ok: true, output: { clientId: client.id, name: client.name, status: client.status } };
        }

        case "add_engagement": {
          const clientId = await resolveClientId(data);
          const eng = await addEngagement({ ...(data as any), clientId });
          return {
            ok: true,
            output: {
              engagementId: eng.id,
              shape: eng.shape,
              title: eng.title,
              price: fromCents(eng.priceCents, eng.currency),
              endsAt: eng.endsAt,
              nextBillingAt: eng.nextBillingAt,
            },
          };
        }

        case "list_engagements": {
          const filter: Record<string, any> = { status: data.status, shape: data.shape };
          if (data.client || data.clientId) filter.clientId = await resolveClientId(data);
          const engagements = await listEngagements(filter);
          return {
            ok: true,
            output: {
              count: engagements.length,
              engagements: engagements.map((e) => ({ ...e, price: fromCents(e.priceCents, e.currency) })),
            },
          };
        }

        case "update_engagement": {
          if (!data.engagementId) throw new Error("update_engagement needs engagementId.");
          const eng = await updateEngagement(String(data.engagementId), data);
          return { ok: true, output: { engagementId: eng.id, status: eng.status, price: fromCents(eng.priceCents, eng.currency) } };
        }

        case "log_session": {
          const clientId = await resolveClientId(data);
          const s = await logSession({ ...(data as any), clientId });
          return { ok: true, output: { sessionId: s.id, kind: s.kind, completedAt: s.completedAt } };
        }

        case "raise_invoice": {
          const clientId = await resolveClientId(data);
          const inv = await raiseInvoice({ ...(data as any), clientId });
          return {
            ok: true,
            output: {
              invoiceId: inv.id,
              amount: fromCents(inv.amountCents, inv.currency),
              dueAt: inv.dueAt,
              // Say plainly what did and did not happen — this is a book entry.
              message: "Recorded as owed. Nothing was sent — sending an invoice is an outward action and needs your confirm.",
            },
          };
        }

        case "record_payment": {
          const clientId = await resolveClientId(data);
          const p = await recordPayment({ ...(data as any), clientId });
          return { ok: true, output: { paymentId: p.id, amount: fromCents(p.amountCents, p.currency), method: p.method, receivedAt: p.receivedAt } };
        }

        case "import_warm_list": {
          const entries = Array.isArray(data.entries) ? data.entries : [];
          if (entries.length === 0) throw new Error("import_warm_list needs an entries array of at least one person.");
          const res = await importWarmList(entries, { source: data.source });
          return {
            ok: true,
            output: {
              ...res,
              message:
                res.created === 0
                  ? "Everyone on that list was already in the pipeline."
                  : `${res.created} added, each with a follow-up due today. The 07:30 sweep will draft the first messages, or run crm.outreach_sweep now.`,
            },
          };
        }

        case "draft_outreach": {
          if (!data.leadId) throw new Error("draft_outreach needs leadId (from list_leads).");
          const res = await draftOutreach(String(data.leadId));
          if (!res.ok) return { ok: false, output: null, error: res.error ?? "draft failed" };
          return {
            ok: true,
            output: {
              bridgeSignalId: res.bridgeSignalId,
              message: res.gated
                ? "Drafted and waiting on your confirm — confirming files it in Gmail drafts. It does not send."
                : "Drafted into your Gmail drafts. Nothing was sent.",
            },
          };
        }

        case "outreach_sweep":
          return { ok: true, output: await runOutreachSweep({ max: Number(data.max) || undefined }) };

        case "outstanding": {
          const rows = await outstandingInvoices();
          const total = rows.reduce((s, r) => s + r.outstandingCents, 0);
          return { ok: true, output: { count: rows.length, total: fromCents(total), invoices: rows } };
        }

        case "record_expense": {
          const e = await addExpense(data as any);
          return {
            ok: true,
            output: {
              expenseId: e.id,
              amount: fromCents(e.amountCents, e.currency),
              category: e.category,
              incurredAt: e.incurredAt,
              message: `Recorded ${fromCents(e.amountCents)} (${e.category}) as spent. A book entry only — nothing was deducted or filed anywhere.`,
            },
          };
        }

        case "expenses": {
          const [summary, recent] = await Promise.all([
            expenseSummary(data.month ? String(data.month) : undefined),
            listExpenses({ month: data.month ? String(data.month) : undefined, limit: 10 }),
          ]);
          return {
            ok: true,
            output: {
              ...summary,
              recent: recent.map((e) => ({
                id: e.id,
                amount: fromCents(e.amountCents, e.currency),
                category: e.category,
                note: e.note,
                incurredAt: e.incurredAt,
              })),
              categories: EXPENSE_CATEGORIES,
            },
          };
        }

        case "text_lead": {
          const res = await stageSms({ leadId: data.leadId, clientId: data.clientId, to: data.to, body: String(data.body ?? "") });
          if (!res.ok) return { ok: false, output: null, error: res.error ?? "could not stage the text" };
          return {
            ok: true,
            output: {
              bridgeSignalId: res.bridgeSignalId,
              message: "Staged and waiting on your confirm — I don't send texts on my own. Confirm on the Bridge to send it.",
            },
          };
        }

        default:
          return { ok: false, output: null, error: `Unknown crm action: ${action}` };
      }
    } catch (err: any) {
      return { ok: false, output: null, error: err?.message ?? String(err) };
    }
  },
};
