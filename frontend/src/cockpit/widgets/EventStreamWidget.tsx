"use client";

import React from "react";
import { EventStreamEntry } from "@/cockpit/types";

interface Props {
  events: EventStreamEntry[];
}

export function EventStreamWidget({ events }: Props) {
  const sorted = [...events].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return (
    <div className="p-4 bg-neutral-900 rounded-lg border border-neutral-700">
      <h2 className="text-xl font-semibold mb-2">Event Stream</h2>

      <div className="space-y-2 text-sm max-h-64 overflow-y-auto">
        {sorted.map((e) => (
          <div key={e.id} className="p-2 bg-neutral-800 rounded">
            <p><strong>[{e.channel}]</strong> {e.message}</p>
            <p className="text-xs opacity-70">
              {new Date(e.timestamp).toLocaleTimeString()}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
