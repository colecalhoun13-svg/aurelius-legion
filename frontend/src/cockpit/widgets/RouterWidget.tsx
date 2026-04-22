"use client";

import React from "react";
import { RouterRouteEvent } from "@/cockpit/types";

interface Props {
  events: RouterRouteEvent[];
}

export function RouterWidget({ events }: Props) {
  return (
    <div className="p-4 bg-neutral-900 rounded-lg border border-neutral-700">
      <h2 className="text-xl font-semibold mb-2">Router Visualizer</h2>
      <div className="space-y-2 text-sm max-h-64 overflow-y-auto">
        {events.map((e) => (
          <div key={e.id} className="p-2 bg-neutral-800 rounded">
            <p><strong>Engine:</strong> {e.engine}</p>
            <p><strong>Route:</strong> {e.route}</p>
            <p><strong>Latency:</strong> {e.latencyMs} ms</p>
            <p className="text-xs opacity-70">
              {new Date(e.timestamp).toLocaleTimeString()}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
