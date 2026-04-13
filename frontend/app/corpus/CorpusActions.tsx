"use client";

import { useState } from "react";

interface CorpusEntry {
  id: string;
  title?: string;
  content?: string;
  tags?: string[];
  [key: string]: any;
}

interface CorpusActionsProps {
  entry: CorpusEntry | null;
  onUpdated: (entry: CorpusEntry) => void;
}

export default function CorpusActions({ entry, onUpdated }: CorpusActionsProps) {
  const [loading, setLoading] = useState(false);

  async function runAction(action: string, payload: Record<string, any> = {}) {
    if (!entry) return;

    setLoading(true);

    const res = await fetch("/api/corpus/actions", {
      method: "POST",
      body: JSON.stringify({
        action,
        id: entry.id,
        payload,
      }),
    });

    const data = await res.json();
    setLoading(false);

    if (data.entry) {
      onUpdated(data.entry);
    }
  }

  if (!entry) {
    return (
      <div className="w-64 p-4 border-l border-white/10">
        <p className="opacity-50">Select an entry to edit</p>
      </div>
    );
  }

  return (
    <div className="w-64 p-4 border-l border-white/10">
      <h2 className="text-lg font-bold mb-4">Actions</h2>

      <button
        onClick={() => runAction("retag", { tags: ["updated"] })}
        className="block w-full mb-2 px-3 py-2 rounded bg-white/10 hover:bg-white/20"
      >
        Retag
      </button>

      <button
        onClick={() => runAction("delete")}
        className="block w-full mb-2 px-3 py-2 rounded bg-red-600/70 hover:bg-red-600"
      >
        Delete
      </button>

      {loading && <p className="text-sm opacity-50 mt-2">Processing…</p>}
    </div>
  );
}
