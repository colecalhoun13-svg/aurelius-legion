"use client";

import React from "react";
import { TaskEngineStatus } from "@/cockpit/types";

interface Props {
  engines: TaskEngineStatus[];
}

export function TaskEngineWidget({ engines }: Props) {
  return (
    <div className="p-4 bg-neutral-900 rounded-lg border border-neutral-700">
      <h2 className="text-xl font-semibold mb-2">Task Engine Monitor</h2>
      <div className="space-y-2 text-sm">
        {engines.map((e) => (
          <div key={e.id} className="p-2 bg-neutral-800 rounded">
            <p><strong>{e.name}</strong></p>
            <p>Active: {e.activeTasks}</p>
            <p>Queued: {e.queuedTasks}</p>
            <p className="text-xs opacity-70">
              Last run: {new Date(e.lastRun).toLocaleTimeString()}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
