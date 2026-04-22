"use client";

import React from "react";
import { AutonomyEvent } from "@/cockpit/types";

interface Props {
  events: AutonomyEvent[];
}

export function AutonomyWidget({ events }: Props) {
  return (
    <div className="p-4 bg-neutral-900 rounded-lg border border-neutral-700">
      <h2 className="text-xl font-semibold mb-2">Autonomy Loop</h2>

      <div className="space-y-2">
        {events.map((evt) => (
          <div key={evt.id} className="p-2 bg-neutral-800 rounded">
            <p><strong>Type:</strong> {evt.type}</p>
            <p><strong>Summary:</strong> {evt.summary}</p>
            {evt.details && <p><strong>Details:</strong> {evt.details}</p>}
            <p className="text-xs opacity-70">
              {new Date(evt.timestamp).toLocaleTimeString()}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
