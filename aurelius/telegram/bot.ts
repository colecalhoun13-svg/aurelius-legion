// aurelius/telegram/bot.ts
//
// THE TELEGRAM BRIDGE — Aurelius in Cole's pocket. Zero dependencies:
// raw Bot API over fetch with long polling. Token-gated: without
// TELEGRAM_BOT_TOKEN the bridge simply doesn't start, so this ships
// dormant and wakes the moment the token lands in .env.
//
// Security: commands only work from TELEGRAM_CHAT_ID. Any other chat
// gets its chat id echoed back (that's how Cole finds his id on first
// contact) and nothing else — the second brain doesn't talk to strangers.
//
// Commands:
//   /brief              — fire the morning briefing now
//   /ask <question>     — recall-grounded answer from the second brain
//   /mission <objective>— launch a background mission
//   /status             — today's numbers at a glance
//   plain text          — quick capture to the inbox
//
// Push: sendToCole() lets scheduled rituals deliver to the phone.

import { generateMorningBriefing } from "../rituals/engine.ts";
import { ask } from "../corpus/ask.ts";
import { launchMission } from "../missions/engine.ts";
import { quickCapture, getToday } from "../productivity/service.ts";

const API = "https://api.telegram.org";

function token(): string | null {
  return process.env.TELEGRAM_BOT_TOKEN?.trim() || null;
}
function allowedChat(): string | null {
  return process.env.TELEGRAM_CHAT_ID?.trim() || null;
}

/** Pull an attached photo/video out of a Telegram message, if any. */
function mediaFromMessage(
  msg: any
): { fileId: string; mime: string; kind: "image" | "video" } | null {
  if (msg?.photo?.length) {
    // photo is an array of sizes — take the largest (last).
    return { fileId: msg.photo[msg.photo.length - 1].file_id, mime: "image/jpeg", kind: "image" };
  }
  if (msg?.video) {
    return { fileId: msg.video.file_id, mime: msg.video.mime_type ?? "video/mp4", kind: "video" };
  }
  const doc = msg?.document;
  if (doc?.mime_type && /^(image|video)\//.test(doc.mime_type)) {
    return { fileId: doc.file_id, mime: doc.mime_type, kind: doc.mime_type.startsWith("image/") ? "image" : "video" };
  }
  return null;
}

async function api(method: string, payload: Record<string, any>): Promise<any> {
  const t = token();
  if (!t) throw new Error("telegram token missing");
  const res = await fetch(`${API}/bot${t}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(`telegram ${method} failed: ${json.description ?? res.status}`);
  return json.result;
}

async function send(chatId: string | number, text: string) {
  // Telegram hard-caps messages at 4096 chars.
  for (let i = 0; i < text.length; i += 4000) {
    await api("sendMessage", { chat_id: chatId, text: text.slice(i, i + 4000) });
  }
}

// ── The phone Bridge ────────────────────────────────────────────────
// Every Bridge ask ALSO reaches Cole's thumb: inline Confirm/Dismiss/Undo
// buttons whose callbacks ride the EXACT same paths as the web Bridge
// (confirmAction's atomic claim makes phone/web double-taps a safe no-op).
// callback_data carries ONLY an opcode + signal id — payloads stay in the DB.

export type BridgeButton = { label: string; data: string };

/** Parse a callback payload. Pure, exported for tests. */
export function parseBridgeCallback(data: string): { op: "confirm" | "undo" | "dismiss"; signalId: string } | null {
  const m = (data ?? "").match(/^(cf|un|ds):([A-Za-z0-9_-]{10,64})$/);
  if (!m) return null;
  const op = m[1] === "cf" ? "confirm" : m[1] === "un" ? "undo" : "dismiss";
  return { op, signalId: m[2] };
}

async function sendWithButtons(chatId: string | number, text: string, buttons: BridgeButton[]) {
  await api("sendMessage", {
    chat_id: chatId,
    text: text.slice(0, 4000),
    reply_markup: { inline_keyboard: [buttons.map((b) => ({ text: b.label, callback_data: b.data }))] },
  });
}

/**
 * Mirror a Bridge ask to the phone. pending → Confirm/Dismiss; acted+undoable →
 * Undo. Dormant-safe (no token/chat → false); never throws into the caller.
 */
export async function pushBridgeAsk(signal: {
  id: string;
  title: string;
  body: string;
  status: string;
  actions?: any;
}): Promise<boolean> {
  const chat = allowedChat();
  if (!token() || !chat) return false;
  try {
    const acts: any[] = Array.isArray(signal.actions) ? signal.actions : [];
    const buttons: BridgeButton[] = [];
    if (signal.status === "pending") {
      buttons.push({ label: "✅ Confirm", data: `cf:${signal.id}` });
      buttons.push({ label: "✖ Dismiss", data: `ds:${signal.id}` });
    } else if (acts.some((a) => a?.action === "undo_action")) {
      buttons.push({ label: "↩ Undo", data: `un:${signal.id}` });
    }
    const text = `${signal.title}\n\n${signal.body}`.slice(0, 3500);
    if (buttons.length === 0) return sendToCole(text);
    await sendWithButtons(chat, text, buttons);
    return true;
  } catch (err) {
    console.warn("[telegram] bridge mirror failed (signal still filed):", (err as any)?.message ?? err);
    return false;
  }
}

/** Handle a tapped button — routes to the same executor paths as the web. */
async function handleBridgeCallback(cb: any, allowed: string): Promise<void> {
  const ack = (text: string) => api("answerCallbackQuery", { callback_query_id: cb.id, text: text.slice(0, 190) }).catch(() => {});
  // Verify the PRESSER, not the chat — a forwarded keyboard still fires
  // callbacks to this bot with the presser's from.id.
  if (String(cb.from?.id ?? "") !== allowed) return ack("This is a private system.");
  const parsed = parseBridgeCallback(cb.data ?? "");
  if (!parsed) return ack("Unknown button.");

  let outcome = "";
  try {
    if (parsed.op === "confirm") {
      const { confirmAction } = await import("../autonomy/executor.ts");
      const r = await confirmAction(parsed.signalId);
      outcome = r?.ok === false ? `Couldn't confirm: ${r?.error ?? "already handled"}` : "✓ Confirmed — done.";
    } else if (parsed.op === "undo") {
      const { undoAction } = await import("../autonomy/executor.ts");
      const r = await undoAction(parsed.signalId);
      outcome = r?.ok ? "↩ Undone." : `Couldn't undo: ${r?.error ?? "already handled"}`;
    } else {
      const { prisma } = await import("../core/db/prisma.ts");
      const updated = await prisma.bridgeSignal.updateMany({
        where: { id: parsed.signalId, status: "pending" },
        data: { status: "dismissed" },
      });
      outcome = updated.count > 0 ? "✖ Dismissed." : "Already handled.";
    }
  } catch (err: any) {
    outcome = `Failed: ${(err?.message ?? String(err)).slice(0, 150)}`;
  }
  await ack(outcome);
  // Strike the keyboard and stamp the outcome on the message so the thread
  // shows resolved state (mirrors the web Bridge's status).
  try {
    const orig = cb.message;
    if (orig?.message_id) {
      await api("editMessageText", {
        chat_id: orig.chat.id,
        message_id: orig.message_id,
        text: `${(orig.text ?? "").slice(0, 3800)}\n\n${outcome}`,
      });
    }
  } catch {
    /* cosmetic — outcome already delivered via the toast */
  }
}

/** Push a message to Cole's chat. No-op (false) when the bridge is dormant. */
export async function sendToCole(text: string): Promise<boolean> {
  const chat = allowedChat();
  if (!token()) return false; // fully dormant — no bot at all, stay quiet (rule 4)
  if (!chat) {
    // HALF-configured: token set but no chat id (Cole hasn't sent his first
    // message). Silently returning false here made rituals compute a briefing,
    // drop it, and still trace status:"ok" — an observability lie (rule 3). Fail
    // loudly, once-ish, so the half-wired bridge is visible instead of eating pushes.
    console.warn("[telegram] push dropped — TELEGRAM_CHAT_ID unset (send the bot a message to bind it).");
    return false;
  }
  try {
    await send(chat, text);
    return true;
  } catch (err) {
    console.error("[telegram] push failed:", err);
    return false;
  }
}

async function handleCommand(chatId: string | number, text: string) {
  const [cmd, ...rest] = text.trim().split(/\s+/);
  const arg = rest.join(" ").trim();

  switch ((cmd ?? "").toLowerCase()) {
    case "/start":
    case "/help":
      await send(
        chatId,
        "Aurelius, standing by.\n\n/brief — morning briefing now\n/ask <question> — ask the second brain\n/mission <objective> — launch a background mission\n/status — today at a glance\n/plan — run the weekly planning session\n/cal — today and tomorrow from the calendar\n/grants — what I can act on for you (grant/revoke keyholes)\n/protect — hold deep-work time on your calendar\n/triage — draft replies to what needs one\nA voice note transcribes and captures the same as text.\nAnything else you type goes straight to the inbox."
      );
      return;

    case "/brief": {
      const { briefing } = await generateMorningBriefing();
      await send(chatId, briefing);
      return;
    }

    case "/ask": {
      if (!arg) return send(chatId, "Ask what? /ask <question>");
      const result = await ask(arg);
      const sources =
        result.sources.length > 0
          ? "\n\n— drawn from: " + result.sources.slice(0, 3).map((s) => s.title).join(" · ")
          : "";
      await send(chatId, result.answer + sources);
      return;
    }

    case "/mission": {
      if (!arg) return send(chatId, "A mission needs an objective. /mission <objective>");
      const mission = await launchMission({ objective: arg, origin: "cole" });
      await send(chatId, `Mission launched: "${mission.title}". I'll report on the Bridge when it lands.`);
      return;
    }

    case "/plan": {
      await send(chatId, "Running the weekly planning session…");
      const { planWeekLite } = await import("../planning/tools.ts");
      const { briefing } = await planWeekLite();
      await send(chatId, briefing);
      return;
    }

    case "/protect": {
      const { runScheduleProtection } = await import("../autonomy/workflows/scheduleProtection.ts");
      const r = await runScheduleProtection({ days: 5 });
      if (r.opportunities === 0) {
        await send(chatId, "Your next few days already have focus time held. Nothing to protect.");
      } else if (r.finalized > 0) {
        await send(chatId, `Protected ${r.finalized} deep-work block${r.finalized === 1 ? "" : "s"} on your calendar (reversible — delete any you don't want). ${r.gated ? `${r.gated} more are on the Bridge for your OK.` : ""}`.trim());
      } else {
        await send(chatId, `Found ${r.opportunities} day${r.opportunities === 1 ? "" : "s"} with unprotected focus time — proposed holds on the Bridge. Grant calendar.schedule_protection (/grants) and I'll just place them.`);
      }
      return;
    }

    case "/triage": {
      const { runInboxTriage } = await import("../autonomy/workflows/inboxTriage.ts");
      const r = await runInboxTriage({ max: 10 });
      if (!r.connected) {
        await send(chatId, "Gmail isn't connected yet — open /api/gmail/auth on the desktop once.");
      } else if (r.needsReply === 0) {
        await send(chatId, `Scanned ${r.scanned} — nothing needs a reply right now.`);
      } else if (r.drafted > 0) {
        await send(chatId, `Drafted ${r.drafted} repl${r.drafted === 1 ? "y" : "ies"} into your Gmail drafts — review and send. ${r.proposed ? `${r.proposed} more on the Bridge.` : ""}`.trim());
      } else {
        await send(chatId, `${r.needsReply} message${r.needsReply === 1 ? "" : "s"} need a reply — drafts are on the Bridge (Confirm & do it to drop them in Gmail). Grant inbox.triage_draft and I'll draft them straight into Gmail.`);
      }
      return;
    }

    case "/grants": {
      const { listActiveGrants } = await import("../autonomy/grants.ts");
      const { listGrantableClasses } = await import("../autonomy/actionClasses.ts");
      const active = await listActiveGrants();
      const grantable = listGrantableClasses();
      const activeLines = active.length
        ? active.map((g) => `✓ ${g.actionClass}`).join("\n")
        : "(none — Aurelius proposes everything, acts on nothing)";
      const menu = grantable
        .map((c) => `  ${active.some((g) => g.actionClass === c.key) ? "●" : "○"} ${c.key} — ${c.description}`)
        .join("\n");
      await send(
        chatId,
        `Active grants:\n${activeLines}\n\nGrantable keyholes (○ off · ● on):\n${menu}\n\n/grant <class> to turn one on · /revoke <class> to turn it off.\nOutward actions (send/publish/spend) can't be granted — I always ask.`
      );
      return;
    }

    case "/grant": {
      if (!arg) return send(chatId, "Grant what? /grant <action-class> (see /grants)");
      try {
        const { grantAutonomy } = await import("../autonomy/grants.ts");
        const g = await grantAutonomy({ actionClass: arg, note: "granted via telegram" });
        await send(chatId, `Granted: ${g.actionClass}. I'll act on that on my own now — reversibly, and it lands on the Bridge. /revoke ${g.actionClass} to take it back.`);
      } catch (err: any) {
        await send(chatId, `Can't grant that: ${err?.message ?? err}`);
      }
      return;
    }

    case "/revoke": {
      if (!arg) return send(chatId, "Revoke what? /revoke <action-class>");
      const { revokeAutonomy } = await import("../autonomy/grants.ts");
      const r = await revokeAutonomy(arg);
      await send(chatId, r ? `Revoked: ${arg}. Back to proposing, not acting.` : `No active grant for "${arg}".`);
      return;
    }

    case "/cal": {
      const { isCalendarConnected } = await import("../calendar/googleAuth.ts");
      if (!(await isCalendarConnected())) {
        return send(chatId, "Calendar isn't connected yet — open /api/calendar/auth on the desktop once.");
      }
      const { listEventsRange } = await import("../calendar/engine.ts");
      const events = await listEventsRange(new Date(), new Date(Date.now() + 2 * 86400_000));
      if (events.length === 0) return send(chatId, "Nothing on the calendar for the next two days.");
      await send(
        chatId,
        events
          .slice(0, 12)
          .map((e) => {
            const day = e.startAt.toISOString().slice(5, 10);
            const time = (e.raw as any)?.allDay ? "all day" : e.startAt.toISOString().slice(11, 16);
            return `${day} ${time} — ${e.title}`;
          })
          .join("\n")
      );
      return;
    }

    case "/status": {
      const today = await getToday();
      await send(
        chatId,
        [
          `Focus: ${today.plan?.focus?.trim() || "(not set)"}`,
          `${today.tasks.length} on deck · ${today.doneToday} done · ${today.overdue.length} overdue · ${today.inboxCount} in inbox`,
          today.habits.length
            ? `Habits: ${today.habits.map((h: any) => `${h.name}${h.doneToday ? " ✓" : ""}`).join(" · ")}`
            : "",
        ]
          .filter(Boolean)
          .join("\n")
      );
      return;
    }

    default: {
      // Plain text → the FULL chat pipeline (tools, planning, memory, second
      // brain), the same one the web chat uses — so "add a task", "what's on
      // today", "plan my day", "grant schedule protection", "draft an IG post"
      // all work from the phone, not just slash commands. The bot runs in the
      // backend process, so we hit the local endpoint over loopback. Fall back
      // to quick-capture only if the pipeline is unreachable or returns nothing.
      try {
        const port = process.env.PORT || "3001";
        // Bounded timeout: this fetch is awaited INSIDE the getUpdates poll loop,
        // so a hung pipeline (wedged provider, stuck tool) with no timeout would
        // freeze the entire bot — no further messages processed until restart.
        // On timeout we abort and fall through to quick-capture.
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 90_000);
        let reply = "";
        try {
          const res = await fetch(`http://localhost:${port}/api/aurelius`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: text }),
            signal: ctrl.signal,
          });
          const data: any = await res.json().catch(() => ({}));
          reply = (data?.reply ?? "").toString().trim();
        } finally {
          clearTimeout(timer);
        }
        if (reply) {
          await send(chatId, reply);
          return;
        }
      } catch (err) {
        console.warn("[telegram] chat pipeline unreachable/timed out — capturing to inbox instead:", (err as any)?.message ?? err);
      }
      await quickCapture({ content: text, captureContext: "telegram" });
      await send(chatId, "Captured to your inbox.");
    }
  }
}

let running = false;

export function startTelegramBridge() {
  if (!token()) {
    console.log("[telegram] no TELEGRAM_BOT_TOKEN — bridge dormant");
    return;
  }
  if (running) return;
  running = true;

  const chat = allowedChat();

  let offset = 0;
  (async () => {
    // Validate the token before polling — but distinguish a REAL rejection
    // (Telegram answered 401/404 → bad token) from a transient network blip
    // at boot. The old code disabled the bridge on ANY error and lied that
    // it was a bad token; a one-second hiccup killed two-way chat until the
    // next restart. Retry a few times; only a definitive auth rejection
    // disables the bridge — transient failures fall through to polling,
    // which has its own retry loop and where sending already works.
    let validated = false;
    let lastErr = "";
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const me = await api("getMe", {});
        console.log(
          `[telegram] bridge live as @${me.username}${chat ? "" : " (TELEGRAM_CHAT_ID unset — will echo chat ids only)"}`
        );
        validated = true;
        break;
      } catch (err: any) {
        lastErr = err?.message ?? String(err);
        // A real bad-token response names the rejection; a network error doesn't.
        if (/not found|unauthorized|401|404/i.test(lastErr)) {
          console.error(
            "[telegram] TOKEN REJECTED — Telegram rejected this bot token.\n" +
              "  Fix TELEGRAM_BOT_TOKEN: format is <digits>:<~35 chars>, no quotes/spaces/'bot' prefix.\n" +
              "  Re-copy from @BotFather → /mybots → API Token. Bridge disabled until fixed + restart."
          );
          running = false;
          return;
        }
        console.warn(`[telegram] getMe attempt ${attempt}/3 failed (${lastErr}) — retrying`);
        await new Promise((r) => setTimeout(r, 2000 * attempt));
      }
    }
    if (!validated) {
      // Never got a clean getMe, but it was never a definitive rejection
      // either. The token likely works (sends already do). Poll anyway —
      // getUpdates has its own 10s retry, so a real bad token surfaces there.
      console.warn(
        `[telegram] getMe didn't confirm (last: ${lastErr}) — proceeding to poll anyway (token likely fine; sends work independently)`
      );
    }
    let conflictStreak = 0;
    while (running) {
      try {
        const updates: any[] = await api("getUpdates", { timeout: 50, offset });
        conflictStreak = 0;
        for (const u of updates) {
          offset = u.update_id + 1;
          // Button taps — the phone Bridge. Handled before message parsing.
          if (u.callback_query) {
            if (chat) await handleBridgeCallback(u.callback_query, chat).catch(() => {});
            continue;
          }
          const msg = u.message;
          const voice = msg?.voice ?? msg?.audio;
          const media = mediaFromMessage(msg);
          if ((!msg?.text && !voice && !media) || !msg.chat?.id) continue;

          const chatId = String(msg.chat.id);
          if (!chat || chatId !== chat) {
            // Not Cole. Echo the id (so Cole can configure) and nothing more.
            // Guard the send: a stranger's stale chat throws "chat not found",
            // which must not bubble to the poll catch and disable the bridge.
            await send(msg.chat.id, `This is a private system. Chat id: ${chatId}`).catch(() => {});
            continue;
          }

          try {
            if (media) {
              // Photo / video → Aurelius sees it, talks about it, remembers it.
              const { analyzeMedia, captureMediaNote } = await import("../media/ingestMedia.ts");
              const f = await api("getFile", { file_id: media.fileId });
              const dl = await fetch(`${API}/file/bot${token()}/${f.file_path}`);
              if (!dl.ok) throw new Error(`couldn't download the ${media.kind} (${dl.status})`);
              const { kind, analysis } = await analyzeMedia(
                Buffer.from(await dl.arrayBuffer()),
                media.mime,
                msg.caption
              );
              captureMediaNote({ kind, analysis, caption: msg.caption }).catch(() => {});
              if (msg.caption?.trim()) {
                // FULL pipeline, not just recall — so "add these to my calendar"
                // on a schedule screenshot fires the calendar tool from the phone,
                // exactly like the web chat.
                await handleCommand(
                  msg.chat.id,
                  `${msg.caption}\n\n[Cole attached a ${kind}. What I can see in it:]\n${analysis}`
                );
              } else {
                await send(msg.chat.id, `Saw your ${kind}:\n\n${analysis}`);
              }
            } else {
              let text = msg.text;
              if (!text && voice) {
                // Voice note → Whisper → the same path as typed words.
                const { transcribeAudio } = await import("./voice.ts");
                const file = await api("getFile", { file_id: voice.file_id });
                const audioRes = await fetch(`${API}/file/bot${token()}/${file.file_path}`);
                if (!audioRes.ok) throw new Error(`couldn't download the voice note (${audioRes.status})`);
                text = await transcribeAudio(Buffer.from(await audioRes.arrayBuffer()));
                await send(msg.chat.id, `Heard: "${text}"`);
              }
              await handleCommand(msg.chat.id, text);
            }
          } catch (err: any) {
            console.error("[telegram] command failed:", err);
            await send(msg.chat.id, `That failed: ${err?.message ?? err}`).catch(() => {});
          }
        }
      } catch (err: any) {
        const m = err?.message ?? String(err);
        // A revoked/rotated token can't be polled away — stop, don't hot-loop
        // forever spraying getUpdates at Telegram. (The prior code retried EVERY
        // error every 10s indefinitely, including this permanent one.) Narrow to
        // AUTH signals only: "not found"/"404" also appears in "chat not found"
        // from a stranger's stale chat, which must NOT disable the whole bridge.
        if (/unauthorized|401/i.test(m)) {
          console.error(
            `[telegram] TOKEN REJECTED during poll (${m}). Bridge disabled — fix TELEGRAM_BOT_TOKEN + restart.`
          );
          running = false;
          break;
        }
        // 409 Conflict = another getUpdates poller is running (a second instance,
        // or a webhook is set). Retrying at 10s just fights it; back off harder
        // and cap so logs don't flood. Usually clears when the other poller dies.
        if (/409|conflict/i.test(m)) {
          conflictStreak++;
          const wait = Math.min(60_000, 10_000 * conflictStreak);
          console.warn(
            `[telegram] getUpdates conflict (${m}) — another poller/webhook is active. ` +
              `Backing off ${Math.round(wait / 1000)}s (streak ${conflictStreak}).`
          );
          await new Promise((r) => setTimeout(r, wait));
          continue;
        }
        console.error("[telegram] poll error (retrying in 10s):", err);
        await new Promise((r) => setTimeout(r, 10_000));
      }
    }
  })();
}

export function stopTelegramBridge() {
  running = false;
}
