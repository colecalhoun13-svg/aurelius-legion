// aurelius/rituals/engine.ts
//
// RITUALS — the push. Aurelius doesn't wait to be asked; the day is
// bracketed by a morning briefing and a nightly debrief, both written
// in the persona voice from real state (plan, tasks, habits, calendar,
// signals, goals). Ritual-first: these earn the interruption.
//
// Structure: facts are assembled deterministically, ALWAYS. The LLM
// adds the voice on top. If no engine is configured, the deterministic
// briefing ships anyway — a ritual never fails to fire for lack of a key.

import { prisma } from "../core/db/prisma.ts";
import { engineUnavailableText } from "../llm/nonAnswer.ts";
import { runLLM } from "../llm/runLLM.ts";
import { extractDirectives } from "../llm/directiveParser.ts";
import { getToday } from "../productivity/service.ts";
import { operatorToday } from "../core/time.ts";
import { runNightlyPulse } from "../autonomy/pulse.ts";
import { localClock } from "../planning/sessionPrep.ts";

const RITUAL_DEFS = [
  { name: "morning_briefing", cadence: "daily_morning", scheduledTime: "07:00" },
  { name: "nightly_debrief", cadence: "daily_night", scheduledTime: "21:30" },
  { name: "weekly_planning", cadence: "weekly_sunday", scheduledTime: "sunday_09:00" },
];

export async function ensureRituals() {
  for (const def of RITUAL_DEFS) {
    await prisma.ritual.upsert({
      where: { name: def.name },
      update: {},
      create: def,
    });
  }
}

// LLM text that indicates no engine answered (keyless environment).
function isEngineUnavailable(text: string): boolean {
  return engineUnavailableText(text);
}

async function voiceOver(skeleton: string, instruction: string): Promise<string> {
  try {
    const response = await runLLM({
      taskType: "chat",
      operators: { primary: "strategy", secondaries: [] },
      noReuse: true, // daily/weekly voice — reuse would replay a prior day
      input: `${instruction}\n\n═══ TODAY'S GROUND TRUTH ═══\n${skeleton}`,
    });
    // Strip any stray [TOOL:]/[SAVE:] directive — the catalog is in the prompt
    // but a briefing must never print a raw directive to Cole.
    if (!isEngineUnavailable(response.text)) {
      const clean = extractDirectives(response.text ?? "").cleanedText || response.text;
      // SAY IT WHEN THE SPINE RAN DEGRADED. Chat has always appended a failover
      // note; the rituals never did — so Cole read a week of briefings written
      // by a substitute model with nothing on the page to say so. The failover
      // was recorded only in a LogEntry field nobody opens.
      if (response.failedOverFrom) {
        return `${clean}\n\n_(${response.failedOverFrom} was unreachable — ${response.engine} wrote this one. Run /doctor.)_`;
      }
      return clean;
    }
  } catch (err) {
    console.warn("[rituals] voice-over failed, shipping deterministic briefing:", err);
  }
  return skeleton;
}

async function fileInstance(ritualName: string, outputText: string, structured?: any) {
  let ritual = await prisma.ritual.findUnique({ where: { name: ritualName } });
  if (!ritual) {
    // Callers outside the server process (Next API routes, CLI) may hit
    // this before index.ts has seeded — self-heal instead of throwing.
    await ensureRituals();
    ritual = await prisma.ritual.findUniqueOrThrow({ where: { name: ritualName } });
  }

  const instance = await prisma.ritualInstance.create({
    data: {
      ritualId: ritual.id,
      scheduledFor: new Date(),
      firedAt: new Date(),
      status: "generated",
      outputText,
      outputStructured: structured ?? undefined,
      deliveredVia: "in_app",
    },
  });

  await prisma.bridgeSignal.create({
    data: {
      kind: "background_result",
      domain: "personal",
      sourceType: "ritual",
      sourceId: instance.id,
      severity: "notice",
      title: ritualName === "morning_briefing" ? "Morning briefing" : "Nightly debrief",
      body: outputText.slice(0, 1500),
    },
  });

  return instance;
}

// ── Morning briefing ─────────────────────────────────────────────────

export async function generateMorningBriefing(dateStr?: string) {
  // ── QUIET MODE, checked lazily where the ritual actually runs (the
  // scheduler can't be edited per-wave; the generator can). Active quiet →
  // the briefing IS the minimal line, nothing else fires from here. An
  // EXPIRED quiet restores itself right here (re-enable + one "back" line),
  // so quiet never needs a boot hook to end.
  let quietBackLine: string | null = null;
  try {
    const { ensureQuietState } = await import("../planning/quiet.ts");
    const q = await ensureQuietState();
    if (q.active) {
      const untilDay = q.until ? new Date(q.until).toISOString().slice(0, 10) : "soon";
      const quietText = `Quiet until ${untilDay}${q.reason ? ` — ${q.reason}` : ""}. Rituals are holding, follow-ups are shifted, nothing is waiting on you here. Say "end quiet" when you're back.`;
      const instance = await fileInstance("morning_briefing", quietText, { quiet: true, until: q.until });
      console.log(`[rituals] quiet-mode briefing (${instance.id})`);
      return { instance, briefing: quietText };
    }
    if (q.restored && q.summary) {
      quietBackLine = `Back — quiet ended. While you were out: ${q.summary}`;
    }
  } catch {
    // quiet is a gate, never a briefing blocker
  }

  const today = await getToday(dateStr ?? operatorToday());

  const lines: string[] = [];
  if (quietBackLine) lines.push(quietBackLine);
  lines.push(`Focus: ${today.plan?.focus?.trim() || "(no focus set yet — set one)"}`);
  lines.push(
    `Deck: ${today.tasks.length} on today, ${today.overdue.length} overdue, ${today.inboxCount} in inbox`
  );
  if (today.tasks.length > 0) {
    lines.push("On deck:");
    for (const t of today.tasks.slice(0, 6)) lines.push(`  • ${t.title}`);
  }
  if (today.overdue.length > 0) {
    lines.push("Overdue:");
    for (const t of today.overdue.slice(0, 4)) lines.push(`  ! ${t.title}`);
  }
  if (today.calendarEvents.length > 0) {
    lines.push("Calendar:");
    for (const e of today.calendarEvents.slice(0, 5)) {
      // localClock, not toISOString — the briefing is the most-read artifact in
      // the system and a UTC clock teaches Cole to distrust it (final council).
      const time = (e.raw as any)?.allDay ? "all day" : localClock(new Date(e.startAt));
      lines.push(`  ◷ ${time} ${e.title}`);
    }
  }
  if (today.habits.length > 0) {
    lines.push(`Habits: ${today.habits.map((h: any) => `${h.name} (streak ${h.streak})`).join(" · ")}`);
  }
  const attention = today.bridgeSignals.filter((s: any) => s.severity !== "info");
  if (attention.length > 0) {
    lines.push("Signals worth a look:");
    for (const s of attention.slice(0, 3)) lines.push(`  ⇄ ${s.title}`);
  }
  // Overnight inbox triage runs at 05:30, ninety minutes before this. Say what
  // it left waiting — a draft nobody knows about is a draft nobody reviews.
  try {
    const since = new Date(Date.now() - 12 * 60 * 60 * 1000);
    // Still-open only: "pending" or "surfaced". A signal Cole already acted
    // on or dismissed isn't waiting on him, and counting it would inflate
    // the number every morning until it expired.
    const openStatus = { status: { in: ["pending", "surfaced"] } };
    // The inbox line KEEPS the 12h window — "drafted overnight" is a genuine
    // time claim about what last night's 05:30 triage produced.
    const drafts = await prisma.bridgeSignal.count({
      where: { sourceType: "inbox_triage", createdAt: { gte: since }, ...openStatus },
    });
    if (drafts > 0) {
      lines.push(`Inbox: ${drafts} repl${drafts === 1 ? "y" : "ies"} drafted overnight, waiting on you (nothing sent).`);
    }

    // EVERY OTHER GATED ASK. The executor's batching comment justified staying
    // silent by saying low-salience asks "wait for the 07:00 briefing, which
    // already counts what's waiting". Nothing counted them — this line only
    // ever matched inbox_triage. So an inward ask that didn't push also never
    // got mentioned, and waited forever. That is the whole failure the
    // batching decision assumed away.
    // "Carries a Confirm button" is the real definition of a gated ask, and
    // it lives in a Json column — so filter it in code rather than contorting
    // the query. NO 12h window here: an open ask is waiting on Cole regardless
    // of age — hiding it for being old is the exact failure the counter fixes
    // (an outward publish confirm he ignored for 13h must still be named).
    const openSignals = await prisma.bridgeSignal.findMany({
      where: { sourceType: { not: "inbox_triage" }, ...openStatus },
      select: { actions: true },
    });
    const gated = openSignals.filter((s) =>
      Array.isArray(s.actions) && (s.actions as any[]).some((a) => a?.action === "confirm_action")
    ).length;
    if (gated > 0) {
      lines.push(
        `${gated} thing${gated === 1 ? "" : "s"} waiting on your confirm — nothing has been sent, ` +
          `published, or spent.`
      );
    }
  } catch {
    // the inbox line is a bonus, never a briefing blocker
  }
  // The business, when there IS one. Blocks ending, renewals, overdue
  // follow-ups and unpaid invoices are the things that cost money if the day
  // swallows them. Silent when the pipeline is empty — an empty CRM has
  // nothing to report and saying so every morning is noise, not honesty.
  try {
    const { whatNeedsAttention } = await import("../crm/service.ts");
    const biz = await whatNeedsAttention(7);
    const bizLines: string[] = [];
    for (const b of biz.blocksEnding.slice(0, 2)) bizLines.push(`  ◈ ${b.client}: ${b.title} ends soon — re-sign conversation`);
    for (const r of biz.renewalsDue.slice(0, 2)) bizLines.push(`  ◈ ${r.client}: ${r.amount} renews`);
    for (const f of biz.followUpsOverdue.slice(0, 2)) bizLines.push(`  ◈ ${f.name}: ${f.action ?? "follow up"} is past due`);
    const overdueInvoices = biz.unpaid.filter((i) => i.overdue).slice(0, 2);
    for (const u of overdueInvoices) bizLines.push(`  ◈ ${u.client} owes $${(u.outstandingCents / 100).toFixed(2)} — overdue`);
    if (bizLines.length > 0) {
      lines.push("Business:");
      lines.push(...bizLines);
    }
  } catch {
    // business layer unavailable — the rest of the briefing stands
  }
  // THE PROMISE LEDGER — the sweep runs here (its daily invoker), then ONE
  // compact block: only promises due today or already lapsed. Kept promises,
  // future promises and an empty ledger say nothing — same silence discipline
  // as the business block.
  try {
    const { lapseSweep, listOpenPromises, dueDayOf } = await import("../productivity/promises.ts");
    await lapseSweep();
    const open = await listOpenPromises();
    const surfacing = open.filter((p) => {
      if (p.status === "lapsed") return true;
      const day = dueDayOf(p.dueAt);
      return day !== null && day <= today.date;
    });
    if (surfacing.length > 0) {
      lines.push("Promises:");
      for (const p of surfacing.slice(0, 4)) {
        const who = p.direction === "owed_by_cole" ? `you → ${p.counterpart}` : `waiting on ${p.counterpart}`;
        const state = p.status === "lapsed" ? "lapsed" : "due today";
        lines.push(`  ⚑ ${who}: ${p.text} — ${state}`);
      }
      if (surfacing.length > 4) lines.push(`  ⚑ +${surfacing.length - 4} more on the ledger`);
    }
  } catch {
    // the ledger is a bonus line, never a briefing blocker
  }
  // THE ANALYST — one confronting truth about the funnel, once a week (Monday).
  // Not a daily number (Cole would tune it out), and it names the leak before
  // the win. Deterministic, built on real click/lead/earned denominators.
  try {
    const isMonday = new Date(`${today.date}T12:00:00`).getDay() === 1;
    if (isMonday) {
      const { businessAnalystRead } = await import("../business/analyst.ts");
      const read = await businessAnalystRead();
      lines.push("This week's read:");
      lines.push(`  ▸ ${read.truth}`);
    }
  } catch {
    // the analyst is a bonus line, never a briefing blocker
  }
  // Earned-trust nudge (council PR4): when Cole has confirmed a class 3×
  // with no undos, the briefing offers the grant — once per cooldown window,
  // max two lines, never a recurring nag. The switch stays his hand.
  try {
    const { freshGrantSuggestions, markSuggestionsSurfaced } = await import("../autonomy/trustLedger.ts");
    const sugg = (await freshGrantSuggestions()).slice(0, 2);
    if (sugg.length > 0) {
      lines.push("Worth handing over (Aurelius → Autonomy):");
      for (const s of sugg) lines.push(`  ♛ ${s.reason}`);
      await markSuggestionsSurfaced(sugg);
    }
  } catch {
    // suggestions are a bonus, never a briefing blocker
  }
  if (today.stats?.followThrough !== null && today.stats?.followThrough !== undefined) {
    lines.push(`Follow-through last 7 days: ${today.stats.followThrough}%`);
  }
  const skeleton = lines.join("\n");

  const briefing = await voiceOver(
    skeleton,
    `Write Cole's morning briefing from the ground truth below. Marcus-Aurelius-through-a-tactical-lens:
open with one line that sets the tone for the day (not a quote — your own words),
then the shape of the day (what matters, what's at risk, what to hit first),
then close with a single directive sentence. Under 180 words. No headers, no bullets-for-the-sake-of-bullets.`
  );

  // Pre-session recall rides as a deterministic footer — the voice pass's
  // word budget can never compress away what the brain remembers about the
  // people on today's calendar. Empty brain = empty footer = calm.
  let prepFooter = "";
  try {
    const { sessionPrepForEvents, formatSessionPrep } = await import("../planning/sessionPrep.ts");
    prepFooter = formatSessionPrep(await sessionPrepForEvents(today.calendarEvents ?? []));
  } catch {
    // prep is a bonus, never a briefing blocker
  }

  // ── THE RISK LINE RIDES THE BRIEFING (alignment council): the single most
  // confrontational computed line in the system was web-only — now the
  // guaranteed daily phone touch carries it. Deterministic footer, so the
  // voice pass can't soften it. Calm days stay calm (no false alarms).
  let riskFooter = "";
  try {
    const { getBiggestRisk } = await import("../productivity/service.ts");
    const risk = await getBiggestRisk(today as any);
    if (risk && !risk.startsWith("Nothing's on fire")) riskFooter = `\n\n⚔ ${risk}`;
  } catch {
    // the risk line is a bonus, never a briefing blocker
  }

  // ── DEBRIEF→DAWN THREAD: last night's "tomorrow starts with X" gets
  // CHECKED, not forgotten. Quiet when honored (on the deck or already done);
  // one confronting line when the promise vanished overnight.
  let dawnFooter = "";
  try {
    const lastDebrief = await prisma.ritualInstance.findFirst({
      where: {
        ritual: { name: "nightly_debrief" },
        firedAt: { gte: new Date(Date.now() - 20 * 3600_000) },
      },
      orderBy: { firedAt: "desc" },
      select: { outputStructured: true },
    });
    const structured = lastDebrief?.outputStructured as any;
    const committed = structured?.tomorrowStarts as { title: string; taskId: string } | undefined;
    // Same-night guard (post-sweep council): a 21:45 "brief me" tap must not
    // confront a commitment made fifteen minutes earlier FOR TOMORROW. The
    // debrief stores its local date — only confront commitments from a
    // PRIOR day.
    const commitmentIsTonights = typeof structured?.date === "string" && structured.date >= today.date;
    if (committed?.taskId && !commitmentIsTonights) {
      const task = await prisma.task.findUnique({
        where: { id: committed.taskId },
        select: { status: true, scheduledFor: true },
      });
      const honored =
        !task ||
        task.status === "done" ||
        task.status === "today" ||
        (task.scheduledFor !== null &&
          task.scheduledFor >= new Date(`${today.date}T00:00:00.000Z`) &&
          task.scheduledFor <= new Date(`${today.date}T23:59:59.999Z`));
      if (!honored) {
        dawnFooter = `\n\n☙ Last night you said today starts with "${committed.title}" — it's not on the deck. Put it there, or tell me what changed.`;
      }
    }
  } catch {
    // the dawn thread is a bonus, never a briefing blocker
  }

  const fullBriefing = briefing + prepFooter + riskFooter + dawnFooter;
  const instance = await fileInstance("morning_briefing", fullBriefing, {
    date: today.date,
    taskCount: today.tasks.length,
    overdueCount: today.overdue.length,
  });

  console.log(`[rituals] morning briefing generated (${instance.id})`);
  return { instance, briefing: fullBriefing };
}

// ── Nightly debrief ──────────────────────────────────────────────────
// Wraps the deterministic nightly pulse (gap math) and voices the close.

export async function generateNightlyDebrief(dateStr?: string) {
  // OPERATOR-LOCAL date, always (post-sweep council): at 21:30 Phoenix the
  // UTC date has already rolled — the default UTC date made listHabits
  // window TOMORROW (every streak read "unbroken" → nightly false alarms)
  // and shifted every date-keyed line by a day.
  const pulse = await runNightlyPulse(dateStr ?? operatorToday());

  const skeleton = [
    `Done today: ${pulse.doneToday} · left open: ${pulse.openToday} · overdue: ${pulse.overdue}`,
    `Intent-action gap: ${(pulse.gapScore * 100).toFixed(0)}% of the deck didn't move`,
    pulse.missedHabits.length > 0 ? `Habits missed: ${pulse.missedHabits.join(", ")}` : "All habits hit.",
  ].join("\n");

  // (The voice pass no longer narrates "how tomorrow starts" — the
  // deterministic footers below own tomorrow, so one artifact can't state
  // it three ways and disagree with itself.)
  const debrief = await voiceOver(
    skeleton,
    `Write Cole's nightly debrief from the ground truth below. Honest, no flattery:
name what moved and what didn't, and one observation about the pattern if
there is one. Under 100 words.`
  );

  // ── TOMORROW-WATCH (alignment council): tomorrow's shape, deterministic,
  // spoken tonight while tonight can still fix it. Rides as a footer so the
  // voice pass's word budget can never compress it away.
  const footerLines: string[] = [];
  // Tomorrow = the day after the OPERATOR-LOCAL date, found by key — not
  // days[1], which at 21:30 Phoenix (UTC already rolled) was the day AFTER
  // tomorrow (post-sweep council). Noon-UTC anchor keeps +24h on the next
  // local day for any timezone within ±12h.
  const tmStr = new Date(new Date(`${pulse.date}T12:00:00.000Z`).getTime() + 86400_000)
    .toISOString()
    .slice(0, 10);
  try {
    const { detectOverload } = await import("../planning/tools.ts");
    const overload = await detectOverload();
    const tm = overload.days.find((d) => d.date === tmStr);
    if (tm && tm.overloaded) {
      footerLines.push(`Tomorrow holds ${tm.due} due against capacity ${tm.capacity} — tonight is when to cut.`);
    } else if (tm && tm.due > 0) {
      footerLines.push(`Tomorrow: ${tm.due} due, capacity ${tm.capacity}.`);
    }
    const firstEvent = await prisma.calendarEvent.findFirst({
      where: { startAt: { gte: new Date(`${tmStr}T00:00:00.000Z`), lte: new Date(`${tmStr}T23:59:59.999Z`) } },
      orderBy: { startAt: "asc" },
      select: { title: true, startAt: true, raw: true },
    });
    if (firstEvent) {
      const t = (firstEvent.raw as any)?.allDay ? "all day" : localClock(firstEvent.startAt);
      footerLines.push(`Tomorrow opens ${t} with ${firstEvent.title}.`);
    }
  } catch {
    // tomorrow-watch is a bonus, never a debrief blocker
  }

  // ── DEBRIEF→DAWN COMMITMENT: name tomorrow's opening move tonight, store
  // it, and let the morning briefing CHECK it. Deterministic pick: the oldest
  // overdue debt first, else the top open task on the deck.
  let tomorrowStarts: { title: string; taskId: string } | null = null;
  try {
    const pick =
      (await prisma.task.findFirst({
        where: { dueDate: { lt: new Date() }, status: { notIn: ["done", "abandoned"] } },
        orderBy: { dueDate: "asc" },
        select: { id: true, title: true },
      })) ??
      (await prisma.task.findFirst({
        where: { status: "today" },
        orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
        select: { id: true, title: true },
      }));
    if (pick) {
      tomorrowStarts = { title: pick.title, taskId: pick.id };
      footerLines.push(`Tomorrow starts with: "${pick.title}". I'll hold you to it at dawn.`);
    }
  } catch {
    // commitment is a bonus, never a debrief blocker
  }

  const fullDebrief = footerLines.length > 0 ? `${debrief}\n\n${footerLines.map((l) => `☙ ${l}`).join("\n")}` : debrief;

  const instance = await fileInstance("nightly_debrief", fullDebrief, {
    date: pulse.date,
    gapScore: pulse.gapScore,
    ...(tomorrowStarts ? { tomorrowStarts } : {}),
  });

  // ── STREAK SENTINEL (alignment council): a long streak breaking is pushed
  // WHILE it's still saveable, not eulogized at 07:00. Reports Cole's own
  // habit state, prescribes nothing (signals-only discipline). dueAt tonight
  // feeds the salience gate's urgency term so it earns the phone.
  try {
    const { listHabits } = await import("../productivity/service.ts");
    const habits = await listHabits(pulse.date);
    const atRisk = (habits as any[]).filter((h) => h.streak >= 7 && !h.doneToday);
    // Local midnight tonight, computed from the operator clock — the UTC-keyed
    // "${date}T23:59Z" was 16:59 Phoenix, so the urgency window never applied
    // and "breaks at midnight" pointed at the wrong midnight (post-sweep).
    const nowLocal = new Date().toLocaleTimeString("en-GB", {
      hour: "2-digit", minute: "2-digit", hour12: false,
      timeZone: process.env.AURELIUS_TZ?.trim() || undefined,
    });
    const minutesLeftToday = 24 * 60 - (Number(nowLocal.slice(0, 2)) * 60 + Number(nowLocal.slice(3, 5)));
    const midnight = new Date(Date.now() + minutesLeftToday * 60_000);
    for (const h of atRisk.slice(0, 3)) {
      // One fire per nightly cycle: a 20h window is TZ-proof (yesterday's
      // 21:30 sentinel is 24h out), and the quoted-name-plus-dash match
      // can't collide "Read" with "Read fiction".
      const already = await prisma.bridgeSignal.findFirst({
        where: {
          sourceType: "streak_sentinel",
          title: { contains: `"${h.name}" —` },
          createdAt: { gte: new Date(Date.now() - 20 * 3600_000) },
        },
        select: { id: true },
      });
      if (already) continue;
      const { surfaceSignal } = await import("../core/bridge.ts");
      await surfaceSignal({
        kind: "gap_alert",
        domain: "personal",
        sourceType: "streak_sentinel",
        severity: "attention",
        title: `"${h.name}" — ${h.streak}-day streak breaks at midnight`,
        body: `Still open today. ${h.streak} days is real capital; one tap keeps it.`,
        dueAt: midnight,
      });
    }
  } catch {
    // the sentinel is a bonus, never a debrief blocker
  }

  console.log(`[rituals] nightly debrief generated (${instance.id})`);
  return { instance, debrief: fullDebrief };
}

// ── Reads ────────────────────────────────────────────────────────────

export async function getLatestRituals() {
  const instances = await prisma.ritualInstance.findMany({
    orderBy: { firedAt: "desc" },
    take: 10,
    include: { ritual: { select: { name: true } } },
  });
  // Latest instance per ritual name
  const latest: Record<string, any> = {};
  for (const i of instances) {
    if (!latest[i.ritual.name]) {
      latest[i.ritual.name] = {
        id: i.id,
        ritual: i.ritual.name,
        firedAt: i.firedAt,
        status: i.status,
        outputText: i.outputText,
      };
    }
  }
  return latest;
}
