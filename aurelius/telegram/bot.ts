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

/** Push a message to Cole's chat. No-op (false) when the bridge is dormant. */
export async function sendToCole(text: string): Promise<boolean> {
  const chat = allowedChat();
  if (!token() || !chat) return false;
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
        "Aurelius, standing by.\n\n/brief — morning briefing now\n/ask <question> — ask the second brain\n/mission <objective> — launch a background mission\n/status — today at a glance\n/plan — run the weekly planning session\n/cal — today and tomorrow from the calendar\n/grants — what I can act on for you (grant/revoke keyholes)\nA voice note transcribes and captures the same as text.\nAnything else you type goes straight to the inbox."
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
      // Plain text — quick capture. Frictionless inbox from anywhere.
      await quickCapture({ content: text, captureContext: "telegram" });
      await send(chatId, "Captured.");
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
    while (running) {
      try {
        const updates: any[] = await api("getUpdates", { timeout: 50, offset });
        for (const u of updates) {
          offset = u.update_id + 1;
          const msg = u.message;
          const voice = msg?.voice ?? msg?.audio;
          if ((!msg?.text && !voice) || !msg.chat?.id) continue;

          const chatId = String(msg.chat.id);
          if (!chat || chatId !== chat) {
            // Not Cole. Echo the id (so Cole can configure) and nothing more.
            await send(msg.chat.id, `This is a private system. Chat id: ${chatId}`);
            continue;
          }

          try {
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
          } catch (err: any) {
            console.error("[telegram] command failed:", err);
            await send(msg.chat.id, `That failed: ${err?.message ?? err}`).catch(() => {});
          }
        }
      } catch (err) {
        console.error("[telegram] poll error (retrying in 10s):", err);
        await new Promise((r) => setTimeout(r, 10_000));
      }
    }
  })();
}

export function stopTelegramBridge() {
  running = false;
}
