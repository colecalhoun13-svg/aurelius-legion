"use client";

import React from "react";
import { ModelLatencyPoint } from "@/cockpit/types";

interface Props {
  points: ModelLatencyPoint[];
}

export function ModelLatencyWidget({ points }: Props) {
  const max = points.reduce((m, p) => Math.max(m, p.avgLatencyMs), 1);

  return (
    <div className="p-4 bg-neutral-900 rounded-lg border border-neutral-700">
      <h2 className="text-xl font-semibold mb-2">Model Latency</h2>
      <div className="space-y-2 text-sm">
        {points.map((p) => (
          <div key={p.model} className="space-y-1">
            <div className="flex justify-between">
              <span>{p.model}</span>
              <span>{p.avgLatencyMs} ms</span>
            </div>
            <div className="h-2 w-full bg-neutral-800 rounded">
              <div
                className="h-2 bg-blue-500 rounded"
                style={{ width: `${(p.avgLatencyMs / max) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
