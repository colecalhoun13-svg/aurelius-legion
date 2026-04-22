"use client";

import React from "react";
import { MemoryEmbeddingPoint } from "@/cockpit/types";

interface Props {
  points: MemoryEmbeddingPoint[];
}

export function MemoryEmbeddingsWidget({ points }: Props) {
  return (
    <div className="p-4 bg-neutral-900 rounded-lg border border-neutral-700">
      <h2 className="text-xl font-semibold mb-2">Memory Embeddings</h2>

      <div className="grid grid-cols-2 gap-2 text-sm">
        {points.map((p) => (
          <div key={p.id} className="p-2 bg-neutral-800 rounded">
            <p><strong>{p.label || p.id}</strong></p>
            <p className="text-xs opacity-70">
              x: {p.x.toFixed(2)}, y: {p.y.toFixed(2)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
