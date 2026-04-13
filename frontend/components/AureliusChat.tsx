/**
 * AureliusChat.tsx
 * Aurelius OS v3.4 — Frontend Chat Interface
 *
 * Wires the UI → Backend → Engine → UI loop.
 */

"use client";

import { useState } from "react";

type Message = {
  role: "user" | "aurelius";
  content: string;
};

export function AureliusChat() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage: Message = { role: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(
        "https://musical-space-doodle-4jxpwg76jwxgcv5j-3001.app.github.dev/api/aurelius",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: userMessage.content })
        }
      );

      if (!res.ok) throw new Error(`Aurelius error: ${res.status}`);

      const data = await res.json();

      const aureliusMessage: Message = {
        role: "aurelius",
        content: data.reply ?? "[No reply received]"
      };

      setMessages((prev) => [...prev, aureliusMessage]);
    } catch (err: any) {
      console.error(err);
      setError("Aurelius encountered an issue reaching the backend.");
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
      <h2 className="text-lg font-semibold mb-3">
        Aurelius OS v3.4 — Console
      </h2>

      <div className="flex flex-col gap-2 mb-3 max-h-80 overflow-y-auto text-sm">
        {messages.length === 0 && (
          <div className="text-zinc-500">
            Type a message below to speak with Aurelius.
          </div>
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
            <div className="whitespace-pre-wrap">{m.content}</div>
          </div>
        ))}
      </div>

      {error && (
        <div className="text-xs text-red-400 mb-2">
          {error}
        </div>
      )}

      <div className="flex gap-2">
        <input
          className="flex-1 bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-yellow-500"
          placeholder="Ask Aurelius anything..."
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
