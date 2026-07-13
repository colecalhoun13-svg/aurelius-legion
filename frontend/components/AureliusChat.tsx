/**
 * AureliusChat.tsx
 * Aurelius OS v3.4 — Frontend Chat Interface
 *
 * Wires the UI → Backend → Engine → UI loop. Multimodal: attach one or more
 * photos/videos and Aurelius sees them and talks about them, in the normal chat.
 */

"use client";

import { useRef, useState } from "react";

type Attachment = { file: File; mimeType: string; kind: "image" | "video"; dataUrl: string };
type Message = {
  role: "user" | "aurelius";
  content: string;
  attachments?: { name: string; kind: "image" | "video" }[];
};

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

    try {
      const res = await fetch("/api/aurelius", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.error ?? `Aurelius error: ${res.status}`);
      }

      const data = await res.json();
      setMessages((prev) => [...prev, { role: "aurelius", content: data.reply ?? "[No reply received]" }]);
    } catch (err: any) {
      console.error(err);
      setError(err?.message ?? "Aurelius encountered an issue reaching the backend.");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex flex-col max-w-xl w-full mx-auto border border-zinc-800 rounded-lg p-4 bg-black/60 text-zinc-100">
      <h2 className="text-lg font-semibold mb-3">Aurelius OS v3.4 — Console</h2>

      <div className="flex flex-col gap-2 mb-3 max-h-80 overflow-y-auto text-sm">
        {messages.length === 0 && (
          <div className="text-zinc-500">Type a message — or attach photos/videos — to speak with Aurelius.</div>
        )}

        {messages.map((m, idx) => (
          <div
            key={idx}
            className={
              m.role === "user"
                ? "self-end bg-zinc-800 px-3 py-2 rounded-lg max-w-[80%]"
                : "self-start bg-zinc-900 px-3 py-2 rounded-lg max-w-[80%] border border-yellow-600/40"
            }
          >
            <div className="text-[10px] uppercase tracking-wide mb-1 text-zinc-500">
              {m.role === "user" ? "Operator" : "Aurelius"}
            </div>
            {m.attachments && m.attachments.length > 0 && (
              <div className="text-[11px] text-yellow-500/80 mb-1 space-y-0.5">
                {m.attachments.map((a, i) => (
                  <div key={i}>{a.kind === "image" ? "🖼" : "🎬"} {a.name}</div>
                ))}
              </div>
            )}
            <div className="whitespace-pre-wrap">{m.content}</div>
          </div>
        ))}
      </div>

      {error && <div className="text-xs text-red-400 mb-2">{error}</div>}

      {attachments.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-2">
          {attachments.map((a, i) => (
            <div key={i} className="flex items-center gap-2 text-xs bg-zinc-900 border border-yellow-600/30 rounded px-2 py-1.5">
              {a.kind === "image" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={a.dataUrl} alt="attachment" className="h-9 w-9 object-cover rounded" />
              ) : (
                <span className="text-lg">🎬</span>
              )}
              <span className="text-zinc-300 max-w-[140px] truncate">{a.file.name}</span>
              <button onClick={() => removeAttachment(i)} className="text-zinc-500 hover:text-red-400" aria-label="remove">✕</button>
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
          className="px-3 py-2 text-sm rounded bg-zinc-800 border border-zinc-700 hover:border-yellow-500 disabled:opacity-50"
        >
          📎
        </button>
        <input
          className="flex-1 bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-yellow-500"
          placeholder="Ask Aurelius anything, or attach photos/videos..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button
          onClick={sendMessage}
          disabled={loading}
          className="px-4 py-2 text-sm rounded bg-yellow-600 hover:bg-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Thinking..." : "Send"}
        </button>
      </div>
    </div>
  );
}
