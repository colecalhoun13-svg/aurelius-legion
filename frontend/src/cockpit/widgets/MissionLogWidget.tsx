"use client";

import React from "react";
import { MissionLogEntry } from "@/cockpit/types";

interface Props {
  logs: MissionLogEntry[];
}

export function MissionLogWidget({ logs }: Props) {
  return (
    <div className="p-4 bg-neutral-900 rounded-lg border border-neutral-700">
      <h2 className="text-xl font-semibold mb-2">Mission Log</h2>

      <div className="space-y-2 max-h-80 overflow-y-auto pr-2">
        {logs.map((log) => (
          <div key={log.id} className="p-2 bg-neutral-800 rounded">
            <p>
              <strong>[{log.level.toUpperCase()}]</strong> {log.message}
            </p>
            <p className="text-xs opacity-70">
              {new Date(log.timestamp).toLocaleTimeString()}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
