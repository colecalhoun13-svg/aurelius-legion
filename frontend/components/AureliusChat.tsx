/**
 * AureliusChat.tsx
 * Aurelius OS v3.4 — Frontend Chat Interface
 *
 * Wires the UI → Backend → Engine → UI loop. Multimodal: attach a photo or
 * short video and Aurelius sees it and talks about it, in the normal chat.
 */

"use client";

import { useRef, useState } from "react";

type Message = {
  role: "user" | "aurelius";
  content: string;
  attachment?: { name: string; kind: "image" | "video" };
};

type Attachment = { file: File; mimeType: string; kind: "image" | "video"; dataUrl: string };

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
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const pickFile = async (file?: File) => {
    if (!file) return;
    const kind = file.type.startsWith("image/") ? "image" : file.type.startsWith("video/") ? "video" : null;
    if (!kind) { setError("Only images and videos can be attached."); return; }
    if (file.size > 18 * 1024 * 1024) { setError("File is over 18MB — too big to attach in chat."); return; }
    setError(null);
    setAttachment({ file, mimeType: file.type, kind, dataUrl: await readAsDataUrl(file) });
  };

  const sendMessage = async () => {
    if ((!input.trim() && !attachment) || loading) return;

    const userMessage: Message = {
      role: "user",
      content: input || (attachment ? `(${attachment.kind} attached)` : ""),
      attachment: attachment ? { name: attachment.file.name, kind: attachment.kind } : undefined,
    };
    setMessages((prev) => [...prev, userMessage]);

    const body: any = { message: input };
    if (attachment) {
      body.media = {
        mimeType: attachment.mimeType,
        kind: attachment.kind,
        filename: attachment.file.name,
        data: attachment.dataUrl.split(",")[1], // strip "data:...;base64,"
      };
    }

    setInput("");
    setAttachment(null);
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
          <div className="text-zinc-500">Type a message — or attach a photo/video — to speak with Aurelius.</div>
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
            {m.attachment && (
              <div className="text-[11px] text-yellow-500/80 mb-1">
                {m.attachment.kind === "image" ? "🖼" : "🎬"} {m.attachment.name}
              </div>
            )}
            <div className="whitespace-pre-wrap">{m.content}</div>
          </div>
        ))}
      </div>

      {error && <div className="text-xs text-red-400 mb-2">{error}</div>}

      {attachment && (
        <div className="flex items-center gap-2 mb-2 text-xs bg-zinc-900 border border-yellow-600/30 rounded px-2 py-1.5 w-fit">
          {attachment.kind === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={attachment.dataUrl} alt="attachment" className="h-10 w-10 object-cover rounded" />
          ) : (
            <span className="text-lg">🎬</span>
          )}
          <span className="text-zinc-300 max-w-[180px] truncate">{attachment.file.name}</span>
          <button onClick={() => { setAttachment(null); if (fileRef.current) fileRef.current.value = ""; }}
            className="text-zinc-500 hover:text-red-400" aria-label="remove attachment">✕</button>
        </div>
      )}

      <div className="flex gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/*,video/*"
          className="hidden"
          onChange={(e) => pickFile(e.target.files?.[0])}
        />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={loading}
          title="Attach a photo or video"
          className="px-3 py-2 text-sm rounded bg-zinc-800 border border-zinc-700 hover:border-yellow-500 disabled:opacity-50"
        >
          📎
        </button>
        <input
          className="flex-1 bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-yellow-500"
          placeholder="Ask Aurelius anything, or attach a photo/video..."
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
