"use client";

import React from "react";
import { AttentionMetric } from "@/cockpit/types";

interface Props {
  metrics: AttentionMetric[];
}

export function AttentionWidget({ metrics }: Props) {
  const sorted = [...metrics].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return (
    <div className="p-4 bg-neutral-900 rounded-lg border border-neutral-700">
      <h2 className="text-xl font-semibold mb-2">Attention Metrics</h2>

      <div className="space-y-2 text-sm max-h-64 overflow-y-auto">
        {sorted.map((m, i) => (
          <div key={i} className="p-2 bg-neutral-800 rounded">
            <p><strong>Focus:</strong> {m.focusArea}</p>
            <p><strong>Weight:</strong> {(m.weight * 100).toFixed(1)}%</p>
            <p className="text-xs opacity-70">
              {new Date(m.timestamp).toLocaleTimeString()}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
