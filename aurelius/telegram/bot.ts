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
        "Aurelius, standing by.\n\n/brief — morning briefing now\n/ask <question> — ask the second brain\n/mission <objective> — launch a background mission\n/status — today at a glance\nAnything else you type goes straight to the inbox."
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
    // Validate the token before polling — a bad token 404s forever, and
    // "getUpdates failed: Not Found" tells nobody anything.
    try {
      const me = await api("getMe", {});
      console.log(
        `[telegram] bridge live as @${me.username}${chat ? "" : " (TELEGRAM_CHAT_ID unset — will echo chat ids only)"}`
      );
    } catch {
      console.error(
        "[telegram] TOKEN REJECTED — Telegram returned Not Found for this bot token.\n" +
          "  Check TELEGRAM_BOT_TOKEN in .env: format is <digits>:<~35 chars>, no quotes,\n" +
          "  no spaces, no 'bot' prefix. Re-copy it from @BotFather → /mybots → API Token.\n" +
          "  Bridge is DISABLED until the token is fixed and the server restarts."
      );
      running = false;
      return;
    }
    while (running) {
      try {
        const updates: any[] = await api("getUpdates", { timeout: 50, offset });
        for (const u of updates) {
          offset = u.update_id + 1;
          const msg = u.message;
          if (!msg?.text || !msg.chat?.id) continue;

          const chatId = String(msg.chat.id);
          if (!chat || chatId !== chat) {
            // Not Cole. Echo the id (so Cole can configure) and nothing more.
            await send(msg.chat.id, `This is a private system. Chat id: ${chatId}`);
            continue;
          }

          try {
            await handleCommand(msg.chat.id, msg.text);
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
