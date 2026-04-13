"use client";

import { useEffect, useState } from "react";

interface CorpusEntry {
  id: string;
  title: string;
  content?: string;
}

export default function CorpusPreview({ entry }: { entry: CorpusEntry }) {
  const [content, setContent] = useState<string | null>(null);

  useEffect(() => {
    if (!entry) return;

    // If the entry already contains content, use it
    if (entry.content) {
      setContent(entry.content);
      return;
    }

    // Otherwise fetch content dynamically (placeholder for now)
    async function loadContent() {
      try {
        const res = await fetch(`/api/corpus/${entry.id}`);
        if (!res.ok) throw new Error("Failed to load corpus entry");
        const data = await res.json();
        setContent(data.content || "No content available.");
      } catch (err) {
        setContent("Error loading content.");
      }
    }

    loadContent();
  }, [entry]);

  if (!entry) return <div>No entry selected.</div>;

  return (
    <div className="p-6 border border-aurelius-border rounded-lg bg-aurelius-panel">
      <h2 className="text-xl font-semibold mb-4 text-aurelius-gold">
        {entry.title}
      </h2>

      <div className="whitespace-pre-wrap text-aurelius-text opacity-90">
        {content || "Loading..."}
      </div>
    </div>
  );
}
