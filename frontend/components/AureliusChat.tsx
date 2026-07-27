/**
 * AureliusChat.tsx
 * Aurelius OS v3.4 — Frontend Chat Interface
 *
 * Wires the UI → Backend → Engine → UI loop. Multimodal: attach one or more
 * photos/videos and Aurelius sees them and talks about them, in the normal chat.
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Attachment = { file: File; mimeType: string; kind: "image" | "video"; dataUrl: string };
type Message = {
  role: "user" | "aurelius";
  content: string;
  attachments?: { name: string; kind: "image" | "video" }[];
};

// A reply in flight survives leaving the page: the backend finishes the work
// and persists both turns regardless, so the screen marks the send in
// sessionStorage and, on return, polls history until the answer lands.
const PENDING_KEY = "aurelius_pending_turn";
const PENDING_TTL_MS = 15 * 60_000;

function readPending(): { text: string; ts: number } | null {
  try {
    const raw = sessionStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (!p?.ts || Date.now() - p.ts > PENDING_TTL_MS) {
      sessionStorage.removeItem(PENDING_KEY);
      return null;
    }
    return p;
  } catch {
    return null;
  }
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

export function AureliusChat() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  // Restore the conversation on mount — the turns were always persisted
  // server-side (that's Aurelius's own continuity); the screen just never
  // asked. Only seeds an empty screen, so it can't clobber a live exchange.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/chat/history")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data?.messages?.length) return;
        setMessages((prev) =>
          prev.length > 0
            ? prev
            : data.messages.map((m: any) => ({ role: m.role === "user" ? "user" : "aurelius", content: String(m.content ?? "") }))
        );
      })
      .catch(() => {}); // history is a nicety — a failed load never blocks chat
    return () => {
      cancelled = true;
    };
  }, []);

  // Resume a reply the screen lost track of — after navigating away mid-turn
  // OR after a gateway timeout (504) hung up on a long think. Either way the
  // backend keeps working and persists the answer; poll history until an
  // aurelius turn newer than the send appears.
  const aliveRef = useRef(true);
  useEffect(() => () => { aliveRef.current = false; }, []);

  const startPendingPoll = useCallback((pending: { text: string; ts: number }) => {
    setLoading(true);
    const poll = async () => {
      if (!aliveRef.current) return;
      if (Date.now() - pending.ts > PENDING_TTL_MS) {
        sessionStorage.removeItem(PENDING_KEY);
        setLoading(false);
        setError("That reply is taking unusually long — it may still land in history; re-ask if it doesn't.");
        return;
      }
      try {
        const r = await fetch("/api/chat/history");
        const data = r.ok ? await r.json() : null;
        const msgs: any[] = data?.messages ?? [];
        const answered = msgs.some((m) => m.role !== "user" && new Date(m.at).getTime() > pending.ts);
        if (answered) {
          sessionStorage.removeItem(PENDING_KEY);
          if (aliveRef.current) {
            setMessages(msgs.map((m) => ({ role: m.role === "user" ? "user" : "aurelius", content: String(m.content ?? "") })));
            setLoading(false);
            setError(null);
          }
          return;
        }
        // Not yet — make sure the pending question is at least visible.
        if (aliveRef.current) {
          setMessages((prev) =>
            prev.length && prev[prev.length - 1].role === "user" && prev[prev.length - 1].content === pending.text
              ? prev
              : [
                  ...msgs.map((m) => ({ role: m.role === "user" ? ("user" as const) : ("aurelius" as const), content: String(m.content ?? "") })),
                  { role: "user" as const, content: pending.text },
                ]
          );
        }
      } catch {
        /* transient — next tick retries */
      }
      if (aliveRef.current) setTimeout(poll, 4000);
    };
    poll();
  }, []);

  useEffect(() => {
    const pending = readPending();
    if (pending) startPendingPoll(pending);
  }, [startPendingPoll]);

  // The backend accepts ≤25MB of JSON, and base64 inflates bytes ~33%. Cap the
  // COMBINED raw size of attached files at ~17MB so the encoded payload stays
  // under the limit — otherwise several photos at once silently 413 server-side.
  const TOTAL_RAW_LIMIT = 17 * 1024 * 1024;

  const pickFiles = async (files?: FileList | null) => {
    if (!files || files.length === 0) return;
    const next: Attachment[] = [];
    let running = attachments.reduce((sum, a) => sum + a.file.size, 0);
    for (const file of Array.from(files)) {
      const kind = file.type.startsWith("image/") ? "image" : file.type.startsWith("video/") ? "video" : null;
      if (!kind) { setError(`Skipped ${file.name} — only images and videos.`); continue; }
      if (file.size > 18 * 1024 * 1024) { setError(`Skipped ${file.name} — over 18MB.`); continue; }
      if (running + file.size > TOTAL_RAW_LIMIT) {
        setError(`Skipped ${file.name} — that would exceed the ~17MB total send limit. Send it in a separate message.`);
        continue;
      }
      running += file.size;
      next.push({ file, mimeType: file.type, kind, dataUrl: await readAsDataUrl(file) });
    }
    if (next.length) { setError(null); setAttachments((prev) => [...prev, ...next]); }
    if (fileRef.current) fileRef.current.value = "";
  };

  const removeAttachment = (idx: number) => setAttachments((prev) => prev.filter((_, i) => i !== idx));

  const sendMessage = async () => {
    if ((!input.trim() && attachments.length === 0) || loading) return;

    const userMessage: Message = {
      role: "user",
      content: input || (attachments.length ? `(${attachments.length} file${attachments.length > 1 ? "s" : ""} attached)` : ""),
      attachments: attachments.map((a) => ({ name: a.file.name, kind: a.kind })),
    };
    setMessages((prev) => [...prev, userMessage]);

    const body: any = { message: input };
    if (attachments.length) {
      body.media = attachments.map((a) => ({
        mimeType: a.mimeType,
        kind: a.kind,
        filename: a.file.name,
        data: a.dataUrl.split(",")[1], // strip "data:...;base64,"
      }));
    }

    setInput("");
    setAttachments([]);
    if (fileRef.current) fileRef.current.value = "";
    setLoading(true);
    setError(null);
    // Mark the send so a page change doesn't orphan the reply — the backend
    // persists it either way; this lets the screen pick it back up on return.
    try {
      sessionStorage.setItem(PENDING_KEY, JSON.stringify({ text: userMessage.content, ts: Date.now() }));
    } catch { /* private mode etc. — nicety only */ }

    try {
      const res = await fetch("/api/aurelius", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.error ?? "Aurelius hit a snag answering that — try again in a moment.");
      }

      const data = await res.json();
      setMessages((prev) => [...prev, { role: "aurelius", content: data.reply ?? "[No reply received]" }]);
      try { sessionStorage.removeItem(PENDING_KEY); } catch { /* nicety */ }
      setLoading(false);
    } catch (err: any) {
      console.error(err);
      const msg = String(err?.message ?? "");
      // Gateway-class failures (504/502, dropped connection): the proxy hung
      // up, not the kitchen — the backend keeps working and persists the
      // reply. Switch to watching history instead of declaring failure.
      const gatewayish = /\b(502|504|524)\b|gateway|timed?\s?out|failed to fetch|networkerror|load failed/i.test(msg);
      const pending = readPending();
      if (gatewayish && pending) {
        setError("The connection timed out, but Aurelius is still working — the answer will drop in here when it's done.");
        startPendingPoll(pending); // keeps loading on until the reply lands
      } else {
        setError(msg || "Aurelius encountered an issue reaching the backend.");
        try { sessionStorage.removeItem(PENDING_KEY); } catch { /* nicety */ }
        setLoading(false);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Staged thinking copy (Outsider's ruling: an in-thread indicator with
  // honest stages beats streaming). Ticks while loading so the copy advances.
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!loading) { setElapsed(0); return; }
    const started = Date.now();
    const t = setInterval(() => setElapsed(Math.round((Date.now() - started) / 1000)), 5000);
    return () => clearInterval(t);
  }, [loading]);
  const thinkingCopy =
    elapsed < 5 ? "Thinking…" :
    elapsed < 20 ? "Working on it…" :
    elapsed < 45 ? "Reading and reasoning — long answers take a minute." :
    "Still at it — deep work under way. This will land, even if you step away.";

  // The deterministic +Task chip: Cole's task list is never trusted to
  // inference. Straight to the API, instant, with a receipt in the thread.
  const addTaskDirect = async () => {
    const title = input.trim();
    if (!title) return;
    setInput("");
    const d = new Date();
    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    try {
      const res = await fetch("/api/today/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "createTask", title, status: "today", date }),
      });
      setMessages((prev) => [
        ...prev,
        { role: "aurelius", content: res.ok ? `✦ Task for today: “${title}” — on the deck.` : `Couldn't add “${title}” — try again in a moment.` },
      ]);
    } catch {
      setMessages((prev) => [...prev, { role: "aurelius", content: `Couldn't add “${title}” — try again in a moment.` }]);
    }
  };

  return (
    <div className="flex flex-col w-full flex-1 aurelius-panel-frame border border-aurelius-gold/25 bg-black/60 text-aurelius-text p-4">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="aurelius-heading text-base text-aurelius-gold/80 tracking-widest">Aurelius</h2>
        <span className="text-[10px] text-neutral-500">one box — the whole mind</span>
      </div>

      <div className="flex flex-col gap-2 mb-3 flex-1 min-h-[240px] max-h-[55vh] overflow-y-auto text-sm">
        {messages.length === 0 && (
          <div className="text-neutral-500">
            Ask anything, give an order, capture a thought, attach photos or video.
          </div>
        )}

        {messages.map((m, idx) => (
          <div
            key={idx}
            className={
              m.role === "user"
                ? "self-end bg-aurelius-gold/15 border border-aurelius-gold/25 px-3 py-2 rounded-lg max-w-[85%]"
                : "self-start bg-black/50 px-3 py-2 rounded-lg max-w-[85%] border border-aurelius-gold/30"
            }
          >
            <div className="text-[10px] uppercase tracking-widest mb-1 text-neutral-500">
              {m.role === "user" ? "Operator" : "Aurelius"}
            </div>
            {m.attachments && m.attachments.length > 0 && (
              <div className="text-[11px] text-aurelius-gold/80 mb-1 space-y-0.5">
                {m.attachments.map((a, i) => (
                  <div key={i}>{a.kind === "image" ? "🖼" : "🎬"} {a.name}</div>
                ))}
              </div>
            )}
            <div className="whitespace-pre-wrap leading-relaxed">{m.content}</div>
          </div>
        ))}

        {loading && (
          <div className="self-start bg-black/50 px-3 py-2 rounded-lg max-w-[85%] border border-aurelius-gold/30">
            <div className="text-[10px] uppercase tracking-widest mb-1 text-neutral-500">Aurelius</div>
            <div className="flex items-center gap-2 text-neutral-400">
              <span className="inline-block w-2 h-2 rounded-full bg-aurelius-gold animate-pulse" />
              {thinkingCopy}
            </div>
          </div>
        )}
      </div>

      {error && <div className="text-xs text-amber-300/90 mb-2">{error}</div>}

      {attachments.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-2">
          {attachments.map((a, i) => (
            <div key={i} className="flex items-center gap-2 text-xs bg-black/50 border border-aurelius-gold/30 rounded px-2 py-1.5">
              {a.kind === "image" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={a.dataUrl} alt="attachment" className="h-9 w-9 object-cover rounded" />
              ) : (
                <span className="text-lg">🎬</span>
              )}
              <span className="text-neutral-300 max-w-[140px] truncate">{a.file.name}</span>
              <button onClick={() => removeAttachment(i)} className="text-neutral-500 hover:text-red-400" aria-label="remove">✕</button>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/*,video/*"
          multiple
          className="hidden"
          onChange={(e) => pickFiles(e.target.files)}
        />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={loading}
          title="Attach photos or videos"
          className="min-w-[44px] px-3 py-2 text-sm rounded-lg bg-black/50 border border-aurelius-gold/30 hover:border-aurelius-gold/70 disabled:opacity-50"
        >
          📎
        </button>
        <input
          className="flex-1 bg-black/50 border border-aurelius-gold/30 rounded-lg px-3 py-2 text-sm outline-none focus:border-aurelius-gold/70 placeholder:text-neutral-600"
          placeholder="Talk to Aurelius…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button
          onClick={addTaskDirect}
          disabled={loading || !input.trim()}
          title="Make this exact text a task for today — instant, no AI in the loop"
          className="px-3 py-2 text-xs rounded-lg border border-aurelius-gold/40 text-aurelius-gold hover:bg-aurelius-gold/15 disabled:opacity-40"
        >
          +Task
        </button>
        <button
          onClick={sendMessage}
          disabled={loading}
          className="px-4 py-2 text-sm font-semibold rounded-lg bg-aurelius-gold text-black hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </div>
  );
}
