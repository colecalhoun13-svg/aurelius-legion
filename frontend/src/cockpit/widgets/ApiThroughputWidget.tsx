"use client";

import React from "react";
import { ApiThroughputPoint } from "@/cockpit/types";

interface Props {
  points: ApiThroughputPoint[];
}

export function ApiThroughputWidget({ points }: Props) {
  const sorted = [...points].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  return (
    <div className="p-4 bg-neutral-900 rounded-lg border border-neutral-700">
      <h2 className="text-xl font-semibold mb-2">API Throughput</h2>
      <div className="space-y-1 text-sm">
        {sorted.map((p) => (
          <div key={p.timestamp} className="flex justify-between">
            <span className="text-xs opacity-70">
              {new Date(p.timestamp).toLocaleTimeString()}
            </span>
            <span>{p.requestsPerMinute} rpm</span>
          </div>
        ))}
      </div>
    </div>
  );
}
