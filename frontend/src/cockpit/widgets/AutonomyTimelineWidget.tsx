"use client";

import React from "react";
import { AutonomyLoopStep } from "@/cockpit/types";

interface Props {
  steps: AutonomyLoopStep[];
}

export function AutonomyTimelineWidget({ steps }: Props) {
  const sorted = [...steps].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  return (
    <div className="p-4 bg-neutral-900 rounded-lg border border-neutral-700">
      <h2 className="text-xl font-semibold mb-2">Autonomy Loop Timeline</h2>

      <div className="space-y-3 text-sm max-h-64 overflow-y-auto">
        {sorted.map((s) => (
          <div key={s.id} className="p-2 bg-neutral-800 rounded">
            <p><strong>{s.phase.toUpperCase()}</strong></p>
            <p>{s.description}</p>
            <p className="text-xs opacity-70">
              {new Date(s.timestamp).toLocaleTimeString()}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
