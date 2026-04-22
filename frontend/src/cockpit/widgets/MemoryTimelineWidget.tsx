"use client";

import React from "react";
import { MemoryTimelinePoint } from "@/cockpit/types";

interface Props {
  points: MemoryTimelinePoint[];
}

export function MemoryTimelineWidget({ points }: Props) {
  return (
    <div className="p-4 bg-neutral-900 rounded-lg border border-neutral-700">
      <h2 className="text-xl font-semibold mb-2">Memory Timeline</h2>
      <div className="space-y-2 text-sm max-h-64 overflow-y-auto">
        {points.map((p) => (
          <div key={p.id} className="p-2 bg-neutral-800 rounded">
            <p><strong>{p.category}</strong> — {p.event}</p>
            <p className="text-xs opacity-70">
              {new Date(p.timestamp).toLocaleTimeString()}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
